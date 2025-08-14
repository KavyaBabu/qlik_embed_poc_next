from pathlib import Path

import boto3
from loguru import logger
from tenacity import retry, stop_after_delay, wait_fixed


class VipeS3Client:
    """A client for interacting with the Vipe S3 bucket."""

    def __init__(self, settings):
        """
        Initializes the client with S3 settings and a boto3 client.
        """
        self.s3_client = boto3.client("s3")
        self.bucket_name = settings.schedule_s3_bucket
        self.ingest_path_prefix = settings.schedule_s3_ingest_path.rstrip("/")
        self.done_path_prefix = settings.schedule_s3_done_path.rstrip("/")

    def _construct_s3_key(self, file_name: str) -> str:
        """Constructs the full S3 object key from the path prefix and filename."""
        return f"{self.ingest_path_prefix}/{file_name}"

    def upload_file(self, local_path: Path) -> str:
        """
        Uploads a local file to the configured S3 path.
        """
        full_s3_key = self._construct_s3_key(local_path.name)
        logger.info(f"Attempting to upload '{local_path.name}' to s3://{self.bucket_name}/{full_s3_key}")
        self.s3_client.upload_file(str(local_path), self.bucket_name, full_s3_key)
        logger.info(
            f"Upload command sent for s3://{self.bucket_name}/{full_s3_key}",
        )
        return full_s3_key

    def list_objects(self, prefix: str) -> list[str]:
        """
        Lists object keys from the configured S3 path.
        """
        logger.info(f"Fetching contents of s3://{self.bucket_name}/{prefix}/ for verification...")
        response = self.s3_client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
        contents = response.get("Contents", [])
        return [item["Key"] for item in contents]

    def verify_upload(self, uploaded_key: str, s3_object_keys: list[str]) -> bool:
        """
        Verifies if the uploaded file key exists in the list of S3 objects.
        """
        logger.info(f"Verifying presence of '{uploaded_key}'...")

        if uploaded_key in s3_object_keys:
            logger.info(
                "Verification successful: File found in the target S3 path.",
            )
            return True
        return False

    @retry(
        stop=stop_after_delay(180),  # 3 minutes
        wait=wait_fixed(10),  # Poll every 10 seconds
        reraise=True,  # Reraise the last exception if all retries fail
    )
    def wait_for_processing(self, original_filename: str) -> bool:
        """
        Polls the 'done' S3 path until a processed file is found.
        This method will be retried by tenacity until it succeeds or times out.
        """
        expected_prefix = f"{original_filename}.done"
        logger.info(f"Polling S3 for processed file starting with '{expected_prefix}'...")
        objects_in_done_path = self.list_objects(prefix=self.done_path_prefix)

        for key in objects_in_done_path:
            if key.split("/")[-1].startswith(expected_prefix):
                logger.info(f"Found processed file: {key}")
                return True

        # If we get here, the file was not found in this attempt.
        # Raise an exception to tell tenacity to try again.
        raise FileNotFoundError(f"Processed file for '{original_filename}' not found yet.")
