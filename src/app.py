import asyncio
import json
import pathlib
import time
import xml.etree.ElementTree as ET
from types import SimpleNamespace

import boto3
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
    creds = response["Credentials"]
    return boto3.client(
        "s3",
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
    )


def is_valid_xml(xml_path: str) -> bool:
    """
    Check if the file contains well-formed XML.
    Returns True if XML is valid, False otherwise.
    """
    try:
        # Parse XML
        ET.parse(xml_path)
        return True
    except ET.ParseError as e:
        logger.error(f"Invalid XML: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error validating XML: {str(e)}")
        return False


def poll_for_processed_schedule(
    s3_client, bucket: str, channel: str, file_name: str, max_wait_time: int = 300, poll_interval: int = 10,
    time_window_min: int = 30, time_window_max: int = 60
) -> bool:
    """
    Poll the processed schedules done path for the uploaded file, matching files with a timestamp in the filename
    within a given time window (in seconds).
    
    Args:
        s3_client: boto3 S3 client
        bucket: S3 bucket name
        channel: Channel identifier (e.g., 'ARQTV3')
        file_name: Name of the file to look for (with .xml extension)
        max_wait_time: Maximum time to wait in seconds (default: 5 minutes)
        poll_interval: Interval between polls in seconds (default: 10 seconds)
        time_window_min: Minimum age of file in seconds (default: 30)
        time_window_max: Maximum age of file in seconds (default: 60)
    
    Returns:
        bool: True if file is found, False if timeout reached
    """
    import re
    from datetime import datetime, timezone

    done_path_prefix = f"rt-demo/procschedules/{channel}/done/"
    expected_filename_part = file_name.replace('.xml', '.json.done')
    logger.info(f"Starting to poll for processed file in path: s3://{bucket}/{done_path_prefix}")

    # Regex to extract timestamp from filename
    # Example: SCH_HHUN_20250515_Final_v1.json.done.Fri Aug 08 2025 11:21:00 GMT+0000 (Coordinated Universal Time)
    timestamp_regex = re.compile(
        re.escape(expected_filename_part) + r"\.(.+)$"
    )

    start_time = time.time()
    while time.time() - start_time < max_wait_time:
        try:
            response = s3_client.list_objects_v2(
                Bucket=bucket,
                Prefix=done_path_prefix
            )
            contents = response.get("Contents", [])
            now = datetime.now(timezone.utc)

            for item in contents:
                key = item["Key"]
                filename = pathlib.Path(key).name
                match = timestamp_regex.match(filename)
                if match:
                    timestamp_str = match.group(1)
                    # Try to parse the timestamp (assume format: Fri Aug 08 2025 11:21:00 GMT+0000 (Coordinated Universal Time))
                    try:
                        # Remove the timezone part for parsing
                        ts_core = timestamp_str.split(" GMT")[0]
                        file_dt = datetime.strptime(ts_core, "%a %b %d %Y %H:%M:%S")
                        # Assume file is in UTC
                        file_dt = file_dt.replace(tzinfo=timezone.utc)
                        age_sec = (now - file_dt).total_seconds()
                        logger.debug(f"Found candidate file: {filename} (age: {age_sec:.1f}s)")
                        if time_window_min <= age_sec <= time_window_max:
                            logger.success(f"Found processed file within time window: {key}")
                            return True
                    except Exception as parse_e:
                        logger.warning(f"Could not parse timestamp in {filename}: {parse_e}")
                        continue
            logger.debug(f"File not found yet. Waiting {poll_interval} seconds...")
        except Exception as e:
            logger.warning(f"Error checking for files in path {done_path_prefix}: {str(e)}")
        time.sleep(poll_interval)

    logger.warning(f"Timeout reached. File not found after {max_wait_time} seconds.")
    return False


def list_files_in_done_path(s3_client, bucket: str, channel: str) -> list[str]:
    """
    List all files in the processed schedules done path for debugging purposes.
    
    Args:
        s3_client: boto3 S3 client
        bucket: S3 bucket name
        channel: Channel identifier
    
    Returns:
        list[str]: List of file keys in the done path
    """
    done_path_prefix = f"rt-demo/procschedules/{channel}/done/"
    
    try:
        response = s3_client.list_objects_v2(Bucket=bucket, Prefix=done_path_prefix)
        contents = response.get("Contents", [])
        file_keys = [item["Key"] for item in contents]
        logger.info(f"Files in {done_path_prefix}: {file_keys}")
        return file_keys
    except Exception as e:
        logger.error(f"Error listing files in {done_path_prefix}: {str(e)}")
        return []


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

    # Extract channel identifier for the done path (e.g., 'ARQTV3' from vipe_channel_id)
    # Adjust this logic based on how your channel mapping works
    channel = event.get("channel", vipe_channel_id)  # Use explicit channel or fallback to vipe_channel_id
    
    # Check if polling is enabled (default: False to avoid timeouts)
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

        # Validate XML structure before processing
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
        processed_found = None
        
        # Only poll if explicitly enabled to avoid Lambda timeouts
        if enable_polling:
            logger.info(f"Polling enabled. Starting to poll for processed schedule for channel: {channel}")

            # Log the current AWS identity for debugging IAM issues
            try:
                sts = s3_client_cross._client_config.credentials._client_creator.create_client('sts', region_name=s3_client_cross.meta.region_name)
                identity = sts.get_caller_identity()
                logger.info(f"Current AWS identity for polling: {identity}")
            except Exception as id_e:
                try:
                    import boto3
                    sts = boto3.client("sts")
                    identity = sts.get_caller_identity()
                    logger.info(f"Current AWS identity for polling (fallback): {identity}")
                except Exception as id_e2:
                    logger.warning(f"Could not fetch AWS identity: {id_e2}")

            # Calculate remaining time for polling (leave 5 seconds buffer for cleanup)
            remaining_time = context.get_remaining_time_in_millis() / 1000 - 5
            max_wait_time = min(event.get("poll_max_wait_time", remaining_time), remaining_time)
            poll_interval = event.get("poll_interval", 5)  # Reduced to 5 seconds for Lambda

            logger.info(f"Polling for max {max_wait_time} seconds with {poll_interval}s intervals")

            if max_wait_time > 0:
                # List files in done path for debugging (optional)
                list_files_in_done_path(s3_client_cross, VIPE_S3_BUCKET, channel)

                processed_found = poll_for_processed_schedule(
                    s3_client=s3_client_cross,
                    bucket=VIPE_S3_BUCKET,
                    channel=channel,
                    file_name=file_name,
                    max_wait_time=max_wait_time,
                    poll_interval=poll_interval
                )
                
                if processed_found:
                    logger.success(f"Processed schedule found for {file_name} in channel {channel}")
                    final_status = "SUCCESS"
                    final_message = f"Schedule file '{file_name}' successfully processed and confirmed in done path."
                    
                    # Update work order status to success if provided
                    if work_order_id:
                        try:
                            update_work_order_status_sync(work_order_id, "SUCCESS")
                        except Exception as async_e:
                            logger.error(f"Failed to update work order status for {work_order_id}: {async_e}")
                else:
                    logger.warning(f"Processed schedule not found for {file_name} in channel {channel} within timeout period")
                    final_status = "IN_PROGRESS"
                    final_message = f"Schedule file '{file_name}' uploaded but processed file not confirmed within timeout."
                    
                    # Update work order status to partial success or warning if provided
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
            # Update work order status to success if provided (upload successful)
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
            "processed_path": f"procschedules/{channel}/done/" if enable_polling else None
        }

    except Exception as e:
        logger.error(f"Error processing file {file_name}: {str(e)}")
        
        # Update work order status to error if provided
        if work_order_id:
            try:
                update_work_order_status_sync(work_order_id, "ERROR")
            except Exception as async_e:
                logger.error(f"Failed to update work order status for {work_order_id}: {async_e}")
        
        return {"status": "ERROR", "message": f"Error processing file {file_name}: {str(e)}", "file_name": file_name}


def update_work_order_status_sync(work_order_id: str, status: str):
    asyncio.run(update_work_order_status(work_order_id, status))
