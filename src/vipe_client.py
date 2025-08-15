from pathlib import Path
import boto3
from loguru import logger
from tenacity import retry, stop_after_delay, wait_fixed


class VipeClientException(Exception):
    """Base exception for Vipe S3 Client errors."""


class VipeProcessingTimeoutException(VipeClientException):
    """Raised when processed file is not found within polling timeout."""


class VipeS3Client:
    """A client for interacting with an S3 bucket (local or cross-account)."""

    def __init__(self, bucket_name, ingest_path_prefix, done_path_prefix, s3_client=None):
        self.s3_client = s3_client or boto3.client("s3")
        self.bucket_name = bucket_name
        self.ingest_path_prefix = ingest_path_prefix.rstrip("/")
        self.done_path_prefix = done_path_prefix.rstrip("/")

    def upload_file(self, local_path: Path) -> str:
        """Uploads a local file to the configured S3 ingest path."""
        full_s3_key = f"{self.ingest_path_prefix}/{local_path.name}"
        logger.info(f"Uploading '{local_path.name}' to s3://{self.bucket_name}/{full_s3_key}")
        try:
            self.s3_client.upload_file(str(local_path), self.bucket_name, full_s3_key)
            logger.info(f"Upload successful: s3://{self.bucket_name}/{full_s3_key}")
            return full_s3_key
        except Exception as e:
            logger.error(f"Failed to upload file to S3: {e}")
            raise VipeClientException(f"Failed to upload {local_path} to {self.bucket_name}") from e

    def list_objects(self, prefix: str) -> list[str]:
        """Lists object keys under the given prefix in the configured S3 bucket."""
        logger.info(f"Fetching contents of s3://{self.bucket_name}/{prefix}...")
        response = self.s3_client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
        contents = response.get("Contents", [])
        return [item["Key"] for item in contents]

    def verify_upload(self, uploaded_key: str, s3_object_keys: list[str]) -> bool:
        """Verifies if the uploaded file key exists in the list of S3 objects."""
        logger.info(f"Verifying presence of '{uploaded_key}'...")
        return uploaded_key in s3_object_keys

    @retry(stop=stop_after_delay(180), wait=wait_fixed(10), reraise=True)
    def wait_for_processing(self, original_filename: str) -> bool:
        """Polls the 'done' S3 path until a processed file is found."""
        expected_prefix = original_filename.replace(".xml", ".json.done")
        keys = self.list_objects(self.done_path_prefix)
        for key in keys:
            if key.split("/")[-1].startswith(expected_prefix):
                logger.success(f"Found processed file: {key}")
                return True
        raise VipeProcessingTimeoutException(
            f"Processed file for '{original_filename}' not found within timeout."
        )
