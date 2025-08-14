import logging
import os

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

try:
    AWS_ACCOUNT_ID = os.environ["AWS_ACCOUNT_ID"]
    AWS_REGION = os.environ["AWS_REGION"]
    ENVIRONMENT = os.environ["ENVIRONMENT"]
    VIPE_CROSS_ACCOUNT_ID = os.environ["VIPE_CROSS_ACCOUNT_ID"]
    VIPE_CROSS_ACCOUNT_ROLE_NAME = os.environ["VIPE_CROSS_ACCOUNT_ROLE_NAME"]
    VIPE_CROSS_ACCOUNT_EXTERNAL_ID_BASE = os.environ["VIPE_CROSS_ACCOUNT_EXTERNAL_ID"]
except KeyError as e:
    logger.error(f"Missing required environment variable: {e}")
    raise

# Schedule S3
SCHEDULE_S3_BUCKET = f"{ENVIRONMENT}-playout-schedule-{AWS_ACCOUNT_ID}"
SCHEDULE_S3_INGEST_PATH = os.environ.get("SCHEDULE_S3_INGEST_PATH", "tx-schedules/incoming")
SCHEDULE_S3_DONE_PATH = os.environ.get("SCHEDULE_S3_DONE_PATH", "tx-schedules/archive")

# VIPE S3
VIPE_S3_BUCKET = os.environ.get("VIPE_S3_BUCKET", f"uat-inbound-media-files-{VIPE_CROSS_ACCOUNT_ID}")
VIPE_S3_KEY_PREFIX_BASE = os.environ.get("VIPE_S3_KEY_PREFIX_BASE", "rt-demo/schedules")
VIPE_S3_DONE_PATH = os.environ.get("VIPE_S3_DONE_PATH", "rt-demo/procschedules")

# Cross-account role
VIPE_CROSS_ACCOUNT_ROLE_ARN = f"arn:aws:iam::{VIPE_CROSS_ACCOUNT_ID}:role/{ENVIRONMENT}-{VIPE_CROSS_ACCOUNT_ROLE_NAME}"
VIPE_CROSS_ACCOUNT_EXTERNAL_ID = f"{ENVIRONMENT}-{VIPE_CROSS_ACCOUNT_EXTERNAL_ID_BASE}"
