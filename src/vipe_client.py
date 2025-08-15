from pathlib import Path

import boto3
from loguru import logger
from tenacity import retry, stop_after_delay, wait_fixed


class VipeS3Client:
    """A client for interacting with an S3 bucket (local or cross-account)."""

    def __init__(self, bucket_name, ingest_path_prefix, done_path_prefix, s3_client=None):
        """
        Initializes the client with S3 settings and a boto3 client.

        :param bucket_name: Name of the S3 bucket
        :param ingest_path_prefix: Path prefix for ingest files
        :param done_path_prefix: Path prefix for processed "done" files
        :param s3_client: Optional custom boto3 S3 client (supports cross-account)
        """
        self.s3_client = s3_client or boto3.client("s3")
        self.bucket_name = bucket_name
        self.ingest_path_prefix = ingest_path_prefix.rstrip("/")
        self.done_path_prefix = done_path_prefix.rstrip("/")

    def _construct_s3_key(self, file_name: str) -> str:
        """Constructs the full S3 object key from the ingest path prefix and filename."""
        return f"{self.ingest_path_prefix}/{file_name}"

    def upload_file(self, local_path: Path) -> str:
        """
        Uploads a local file to the configured S3 ingest path.
        """
        full_s3_key = self._construct_s3_key(local_path.name)
        logger.info(f"Attempting to upload '{local_path.name}' to s3://{self.bucket_name}/{full_s3_key}")
        self.s3_client.upload_file(str(local_path), self.bucket_name, full_s3_key)
        logger.info(f"Upload command sent for s3://{self.bucket_name}/{full_s3_key}")
        return full_s3_key

    def list_objects(self, prefix: str) -> list[str]:
        """
        Lists object keys under the given prefix in the configured S3 bucket.
        """
        logger.info(f"Fetching contents of s3://{self.bucket_name}/{prefix} for verification...")
        response = self.s3_client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
        contents = response.get("Contents", [])
        return [item["Key"] for item in contents]

    def verify_upload(self, uploaded_key: str, s3_object_keys: list[str]) -> bool:
        """
        Verifies if the uploaded file key exists in the list of S3 objects.
        """
        logger.info(f"Verifying presence of '{uploaded_key}'...")
        if uploaded_key in s3_object_keys:
            logger.info("Verification successful: File found in the target S3 path.")
            return True
        return False

    @retry(
        stop=stop_after_delay(180),  # Wait up to 5 minutes
        wait=wait_fixed(10),  # Poll every 2 seconds
        reraise=True,  # Reraise the last exception if all retries fail
    )
    def wait_for_processing(self, original_filename: str) -> bool:
        """
        Polls the 'done' S3 path until a processed file is found.
        This method is resilient to delays and will retry until success or timeout.

        :param original_filename: The original .xml filename
        :return: True if processed file found, raises FileNotFoundError otherwise
        """
        expected_prefix = original_filename.replace(".xml", ".json.done")
        keys = self.list_objects(self.done_path_prefix)
        for key in keys:
            if key.split("/")[-1].startswith(expected_prefix):
                logger.success(f"Found processed file: {key}")
                return True
        raise FileNotFoundError(f"Processed file for '{original_filename}' not found yet.")
