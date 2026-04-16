import boto3
import os
from botocore.exceptions import ClientError

s3_client = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION", "ap-south-1"),
)

BUCKET = os.getenv("S3_BUCKET_NAME", "ekk-idms-media")

def upload_file(file_bytes: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    s3_client.put_object(Bucket=BUCKET, Key=key, Body=file_bytes, ContentType=content_type)
    return f"https://{BUCKET}.s3.amazonaws.com/{key}"

def get_presigned_url(key: str, expires: int = 3600) -> str:
    return s3_client.generate_presigned_url(
        "get_object", Params={"Bucket": BUCKET, "Key": key}, ExpiresIn=expires
    )
