import json
import pathlib
import xml.etree.ElementTree as ET

import boto3
from loguru import logger
from schedules.config import (
    SCHEDULE_S3_BUCKET,
    SCHEDULE_S3_DONE_PATH,
    SCHEDULE_S3_INGEST_PATH,
    VIPE_CROSS_ACCOUNT_EXTERNAL_ID,
    VIPE_CROSS_ACCOUNT_ROLE_ARN,
    VIPE_S3_BUCKET,
    VIPE_S3_DONE_PATH,
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
        ET.parse(xml_path)
        return True
    except ET.ParseError as e:
        logger.error(f"Invalid XML: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error validating XML: {str(e)}")
        return False


def update_work_order_status_sync(work_order_id: str, status: str):
    """
    Updates the work order status synchronously.
    """
    update_work_order_status(work_order_id, status)


def handler(event: dict, context: dict) -> dict:
    """
    Handler for processing Arqiva XML schedules and uploading them
    as VIPE Native JSON to both the schedules archive and the VIPE bucket.
    """
    file_name = event.get("file_name")
    if not file_name:
        logger.error("Missing required 'file_name' in event payload")
        return {"status": "ERROR", "message": "Missing required 'file_name' in event payload"}

    work_order_id = event.get("work_order_id")
    if work_order_id is None:
        logger.warning("Missing work_order_id in event payload; status updates will be skipped.")
        return {"status": "ERROR", "message": "Missing work_order_id in event payload", "work_order_id": work_order_id}

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

    fps = float(event.get("fps", 25.0))
    enable_polling = event.get("enable_polling", False)

    # Construct keys and paths
    source_key = f"{SCHEDULE_S3_INGEST_PATH}/{file_name}"
    archive_json_key = file_name.replace(".xml", ".json")
    archive_json_full_key = f"{SCHEDULE_S3_DONE_PATH}/{archive_json_key}"
    vipe_json_key = f"{VIPE_S3_KEY_PREFIX_BASE}/{vipe_channel_id}/{archive_json_key}"

    # Initialize local S3 client for SCHEDULE bucket
    s3_client_local = VipeS3Client(
        bucket_name=SCHEDULE_S3_BUCKET,
        ingest_path_prefix=SCHEDULE_S3_INGEST_PATH,
        done_path_prefix=SCHEDULE_S3_DONE_PATH,
    )

    local_xml_path = f"/tmp/{file_name}"
    local_json_path = f"/tmp/{archive_json_key}"

    try:
        # Download XML
        logger.info("Downloading source XML from s3://{bucket}/{key}", bucket=SCHEDULE_S3_BUCKET, key=source_key)
        s3_client_local.s3_client.download_file(SCHEDULE_S3_BUCKET, source_key, local_xml_path)

        # Validate XML structure before processing
        if not is_valid_xml(local_xml_path):
            error_msg = f"File {file_name} contains malformed XML"
            logger.error(error_msg)
            update_work_order_status_sync(work_order_id, "ERROR")
            return {"status": "ERROR", "message": error_msg, "file_name": file_name}

        # Transform XML -> VIPE JSON
        logger.info("Parsing and transforming {} to VIPE Native JSON...", file_name)
        arqiva_schedule = parse_arqiva_file_to_pydantic(local_xml_path)
        vipe_json_data = transform_arqiva_to_vipe_native_json(arqiva_schedule, vipe_channel_id, fps)
        pathlib.Path(local_json_path).write_text(json.dumps(vipe_json_data, indent=4), encoding="utf-8")

        # Upload to archive S3
        logger.info(
            "Uploading JSON archive to s3://{bucket}/{key}", bucket=SCHEDULE_S3_BUCKET, key=archive_json_full_key
        )
        s3_client_local.s3_client.upload_file(local_json_path, SCHEDULE_S3_BUCKET, archive_json_full_key)

        # Upload to VIPE bucket in cross-account
        logger.info("Assuming cross-account role to upload to VIPE bucket...")
        s3_client_cross = assume_cross_account_role()
        vipe_cross_client = VipeS3Client(
            bucket_name=VIPE_S3_BUCKET,
            ingest_path_prefix=f"{VIPE_S3_KEY_PREFIX_BASE}/{vipe_channel_id}",
            done_path_prefix=f"{VIPE_S3_DONE_PATH}/{vipe_channel_id}/done",
            s3_client=s3_client_cross,
        )

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

        channel = event.get("channel", vipe_channel_id)
        processed_found = None

        # Poll for processed file if enabled
        if enable_polling:
            logger.info(f"Polling enabled. Waiting for processed file for {file_name} in channel {channel}...")
            try:
                processed_found = vipe_cross_client.wait_for_processing(file_name)
                if processed_found:
                    update_work_order_status_sync(work_order_id, "COMPLETE")
                else:
                    update_work_order_status_sync(work_order_id, "IN_PROGRESS")
            except Exception as e:
                logger.error(f"Processed file not found within timeout for {file_name}: {e}")
                processed_found = False
                update_work_order_status_sync(work_order_id, "ERROR")

        else:
            update_work_order_status_sync(work_order_id, "COMPLETE")

        return {
            "status": "COMPLETE" if processed_found is not False else "IN_PROGRESS",
            "message": f"Schedule file '{file_name}' uploaded and processed.",
            "archived_json": f"s3://{SCHEDULE_S3_BUCKET}/{archive_json_full_key}",
            "vipe_json": f"s3://{VIPE_S3_BUCKET}/{vipe_json_key}",
            "file_name": file_name,
            "channel": vipe_channel_id,
            "polling_enabled": enable_polling,
            "processed_found": processed_found,
        }

    except Exception as e:
        logger.error(f"Error processing file {file_name}: {str(e)}")
        update_work_order_status_sync(work_order_id, "ERROR")
        return {"status": "ERROR", "message": f"Error processing file {file_name}: {str(e)}", "file_name": file_name}
