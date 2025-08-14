import json
import pathlib
import time
import xml.etree.ElementTree as ET
from types import SimpleNamespace
from datetime import datetime, timezone
from typing import Iterator, List, Optional

import boto3
from botocore.exceptions import ClientError
from loguru import logger

from schedules.config import (
    SCHEDULE_S3_BUCKET,
    SCHEDULE_S3_DONE_PATH,
    SCHEDULE_S3_INGEST_PATH,
    VIPE_CROSS_ACCOUNT_EXTERNAL_ID,
    VIPE_CROSS_ACCOUNT_ROLE_ARN,
    VIPE_S3_BUCKET,
    VIPE_S3_KEY_PREFIX_BASE,
)
from schedules.core import (
    parse_arqiva_file_to_pydantic,
    transform_arqiva_to_vipe_native_json,
)
from schedules.vipe_client import VipeS3Client
from work_order_status_updater import update_work_order_status


# ---------------------------
# Cross-account role helpers
# ---------------------------

def assume_cross_account_role():
    """
    Use STS to assume the cross-account role and
    return an S3 client authenticated with temporary credentials.
    """
    sts_client = boto3.client("sts")
    response = sts_client.assume_role(
        RoleArn=VIPE_CROSS_ACCOUNT_ROLE_ARN,
        RoleSessionName="VipeS3UploadSession",
        ExternalId=VIPE_CROSS_ACCOUNT_EXTERNAL_ID,
    )
    arn = response.get("AssumedRoleUser", {}).get("Arn")
    if arn:
        logger.info(f"Assumed role: {arn}")

    creds = response["Credentials"]
    return boto3.client(
        "s3",
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
    )


# ---------------------------
# Validation helpers
# ---------------------------

def is_valid_xml(xml_path: str) -> bool:
    """Check if the file contains well-formed XML."""
    try:
        ET.parse(xml_path)
        return True
    except ET.ParseError as e:
        logger.error(f"Invalid XML: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error validating XML: {str(e)}")
        return False


# ---------------------------
# S3 listing/polling helpers
# ---------------------------

def _paginate_list_objects(s3_client, bucket: str, prefix: str) -> Iterator[dict]:
    """Generator over all S3 objects under a prefix (handles pagination)."""
    token = None
    while True:
        kwargs = {"Bucket": bucket, "Prefix": prefix, "MaxKeys": 1000}
        if token:
            kwargs["ContinuationToken"] = token
        resp = s3_client.list_objects_v2(**kwargs)
        for item in resp.get("Contents", []):
            yield item
        if resp.get("IsTruncated"):
            token = resp.get("NextContinuationToken")
        else:
            break


def list_files_in_done_path(s3_client, bucket: str, channel: str) -> List[str]:
    """
    List all files in the processed schedules done path for debugging purposes.
    """
    done_path_prefix = f"rt-demo/procschedules/{channel}/done/"
    try:
        keys = [it["Key"] for it in _paginate_list_objects(s3_client, bucket, done_path_prefix)]
        logger.info(f"Files in {done_path_prefix}: {keys}")
        return keys
    except ClientError as ce:
        logger.error(f"Error listing files in {done_path_prefix}: {ce}")
        return []
    except Exception as e:
        logger.error(f"Error listing files in {done_path_prefix}: {e}")
        return []


def poll_for_processed_schedule(
    s3_client,
    bucket: str,
    channel: str,
    file_name: str,
    max_wait_time: int = 300,
    poll_interval: int = 10,
    time_window_min: int = 30,
    time_window_max: int = 60,
) -> Optional[bool]:
    """
    Poll the processed schedules 'done' path for a file corresponding to file_name.
    Instead of parsing timestamps from filenames, rely on S3 LastModified time.

    Returns:
        True if a matching file is found within the age window,
        False if not found before timeout or access denied,
        None if a non-permission S3 error occurred (caller may decide how to treat).
    """
    done_path_prefix = f"rt-demo/procschedules/{channel}/done/"
    expected_prefix = file_name.replace(".xml", ".json.done")
    logger.info(f"Starting to poll for processed file in path: s3://{bucket}/{done_path_prefix}")

    start_time = time.time()
    while time.time() - start_time < max_wait_time:
        try:
            now = datetime.now(timezone.utc)
            found_any_matching_basename = False

            for item in _paginate_list_objects(s3_client, bucket, done_path_prefix):
                key = item["Key"]
                basename = key.rsplit("/", 1)[-1]
                if not basename.startswith(expected_prefix):
                    continue

                found_any_matching_basename = True
                lastmod = item.get("LastModified")
                if not lastmod:
                    continue

                age_sec = (now - lastmod).total_seconds()
                logger.debug(f"Candidate: {key} (age: {age_sec:.1f}s)")
                if time_window_min <= age_sec <= time_window_max:
                    logger.success(f"Found processed file within time window: {key}")
                    return True

            if not found_any_matching_basename:
                logger.debug(f"No candidates yet under {done_path_prefix} for base {expected_prefix}")

        except ClientError as ce:
            code = ce.response.get("Error", {}).get("Code")
            if code in ("AccessDenied", "AuthorizationHeaderMalformed"):
                logger.error(f"Access denied on {bucket}/{done_path_prefix}: {ce}")
                # Fast-fail for permission issues
                return False
            logger.warning(f"S3 client error while polling: {ce}")
            return None
        except Exception as e:
            logger.warning(f"Unhandled error while polling: {e}")
            return None

        time.sleep(max(1, min(int(poll_interval), 30)))

    logger.warning(f"Timeout reached. File not found after {max_wait_time} seconds.")
    return False


# ---------------------------
# Lambda handler
# ---------------------------

def handler(event: dict, context: dict) -> dict:
    file_name = event.get("file_name")
    if not file_name:
        logger.error("Missing required 'file_name' in event payload")
        return {"status": "ERROR", "message": "Missing required 'file_name' in event payload"}

    work_order_id = event.get("work_order_id")
    if not file_name.endswith(".xml"):
        logger.error("Input file must have a .xml extension: {}", file_name)
        return {"status": "ERROR", "message": "Input file must have a .xml extension", "file_name": file_name}

    vipe_channel_id = event.get("vipe_channel_id")
    if not vipe_channel_id:
        logger.error("Missing required 'vipe_channel_id' in event payload")
        return {
            "status": "ERROR",
            "message": "Missing required 'vipe_channel_id' in event payload",
            "file_name": file_name,
        }

    # Channel used in done path (fallback to vipe_channel_id if not explicitly provided)
    channel = event.get("channel", vipe_channel_id)

    # Polling is opt-in to avoid timeouts by default
    enable_polling = event.get("enable_polling", False)

    fps = float(event.get("fps", 25.0))

    source_key = f"{SCHEDULE_S3_INGEST_PATH}/{file_name}"
    archive_json_key = file_name.replace(".xml", ".json")
    archive_json_full_key = f"{SCHEDULE_S3_DONE_PATH}/{archive_json_key}"
    vipe_json_key = f"{VIPE_S3_KEY_PREFIX_BASE}/{vipe_channel_id}/{archive_json_key}"

    settings = SimpleNamespace(
        schedule_s3_bucket=SCHEDULE_S3_BUCKET,
        schedule_s3_ingest_path=SCHEDULE_S3_INGEST_PATH,
        schedule_s3_done_path=SCHEDULE_S3_DONE_PATH,
    )

    s3_client_local = VipeS3Client(settings=settings)

    local_xml_path = f"/tmp/{file_name}"
    local_json_path = f"/tmp/{archive_json_key}"

    try:
        logger.info("Downloading source XML from s3://{bucket}/{key}", bucket=SCHEDULE_S3_BUCKET, key=source_key)
        s3_client_local.s3_client.download_file(SCHEDULE_S3_BUCKET, source_key, local_xml_path)

        if not is_valid_xml(local_xml_path):
            error_msg = f"File {file_name} contains malformed XML"
            logger.error(error_msg)
            if work_order_id:
                try:
                    update_work_order_status_sync(work_order_id, "ERROR")
                except Exception as async_e:
                    logger.error(f"Failed to update work order status for {work_order_id}: {async_e}")
            return {"status": "ERROR", "message": error_msg, "file_name": file_name}

        logger.info("Parsing and transforming {} to VIPE Native JSON...", file_name)
        arqiva_schedule = parse_arqiva_file_to_pydantic(local_xml_path)
        vipe_json_data = transform_arqiva_to_vipe_native_json(arqiva_schedule, vipe_channel_id, fps)

        pathlib.Path(local_json_path).write_text(json.dumps(vipe_json_data, indent=4), encoding="utf-8")

        logger.info(
            "Uploading JSON archive to s3://{bucket}/{key}", bucket=SCHEDULE_S3_BUCKET, key=archive_json_full_key
        )
        s3_client_local.s3_client.upload_file(local_json_path, SCHEDULE_S3_BUCKET, archive_json_full_key)

        logger.info("Assuming cross-account role to upload to VIPE bucket...")
        s3_client_cross = assume_cross_account_role()

        logger.info(
            "Uploading JSON to VIPE bucket s3://{bucket}/{key} with ACL bucket-owner-full-control",
            bucket=VIPE_S3_BUCKET,
            key=vipe_json_key,
        )
        s3_client_cross.upload_file(
            local_json_path,
            VIPE_S3_BUCKET,
            vipe_json_key,
            ExtraArgs={"ACL": "bucket-owner-full-control"},
        )

        logger.success("Schedule file '{}' successfully transformed and uploaded.", file_name)

        # Initialize default response
        final_status = "SUCCESS"
        final_message = f"Schedule file '{file_name}' successfully transformed and uploaded."
        processed_found: Optional[bool] = None

        if enable_polling:
            logger.info(f"Polling enabled. Starting to poll for processed schedule for channel: {channel}")

            # Calculate remaining time for polling (leave 5 seconds buffer for cleanup)
            remaining_time = context.get_remaining_time_in_millis() / 1000 - 5
            max_wait_time = min(float(event.get("poll_max_wait_time", remaining_time)), remaining_time)
            poll_interval = int(event.get("poll_interval", 5))  # reasonable default for Lambda

            logger.info(f"Polling for max {max_wait_time:.0f} seconds with {poll_interval}s intervals")

            if max_wait_time > 0:
                # Optional: list current keys for immediate visibility
                list_files_in_done_path(s3_client_cross, VIPE_S3_BUCKET, channel)

                processed_found = poll_for_processed_schedule(
                    s3_client=s3_client_cross,
                    bucket=VIPE_S3_BUCKET,
                    channel=channel,
                    file_name=file_name,
                    max_wait_time=int(max_wait_time),
                    poll_interval=poll_interval,
                )

                if processed_found is True:
                    logger.success(f"Processed schedule found for {file_name} in channel {channel}")
                    final_status = "SUCCESS"
                    final_message = f"Schedule file '{file_name}' successfully processed and confirmed in done path."
                    if work_order_id:
                        try:
                            update_work_order_status_sync(work_order_id, "SUCCESS")
                        except Exception as async_e:
                            logger.error(f"Failed to update work order status for {work_order_id}: {async_e}")
                elif processed_found is False:
                    # Could be timeout or access denied; message below keeps it neutral.
                    logger.warning(
                        f"Processed schedule not found or not accessible for {file_name} in channel {channel} within timeout"
                    )
                    final_status = "IN_PROGRESS"
                    final_message = (
                        f"Schedule file '{file_name}' uploaded but processed file not confirmed within timeout."
                    )
                    if work_order_id:
                        try:
                            update_work_order_status_sync(work_order_id, "IN_PROGRESS")
                        except Exception as async_e:
                            logger.error(f"Failed to update work order status for {work_order_id}: {async_e}")
                else:
                    # None => unexpected S3 error during polling (non-permission)
                    logger.error("Unexpected S3 error occurred during polling.")
                    final_status = "IN_PROGRESS"
                    final_message = (
                        f"Schedule file '{file_name}' uploaded; polling encountered an error. Please check logs."
                    )
                    if work_order_id:
                        try:
                            update_work_order_status_sync(work_order_id, "IN_PROGRESS")
                        except Exception as async_e:
                            logger.error(f"Failed to update work order status for {work_order_id}: {async_e}")
            else:
                logger.warning("Not enough time remaining for polling")
                final_status = "IN_PROGRESS"
                final_message = f"Schedule file '{file_name}' uploaded but insufficient time for polling."
        else:
            logger.info("Polling disabled. Skipping processed file check.")
            if work_order_id:
                try:
                    update_work_order_status_sync(work_order_id, "SUCCESS")
                except Exception as async_e:
                    logger.error(f"Failed to update work order status for {work_order_id}: {async_e}")

        return {
            "status": final_status,
            "message": final_message,
            "archived_json": f"s3://{SCHEDULE_S3_BUCKET}/{archive_json_full_key}",
            "vipe_json": f"s3://{VIPE_S3_BUCKET}/{vipe_json_key}",
            "file_name": file_name,
            "channel": channel,
            "polling_enabled": enable_polling,
            "processed_found": processed_found,
            # FIX: include 'rt-demo/' so it matches actual listing prefix
            "processed_path": f"rt-demo/procschedules/{channel}/done/" if enable_polling else None,
        }

    except Exception as e:
        logger.error(f"Error processing file {file_name}: {str(e)}")

        if work_order_id:
            try:
                update_work_order_status_sync(work_order_id, "ERROR")
            except Exception as async_e:
                logger.error(f"Failed to update work order status for {work_order_id}: {async_e}")

        return {"status": "ERROR", "message": f"Error processing file {file_name}: {str(e)}", "file_name": file_name}


def update_work_order_status_sync(work_order_id: str, status: str):
    """
    Wrapper that calls the synchronous updater.
    (The underlying implementation is sync; do NOT use asyncio.run here.)
    """
    update_work_order_status(work_order_id, status)
