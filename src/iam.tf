########################################
# Providers
########################################
# Default provider -> SOURCE account (where Lambda runs), e.g., 943412361827
provider "aws" {
  region = var.aws_region
}

# Aliased provider -> VIPE account (bucket lives here), e.g., 980921750886
# Configure creds or assume_role to target VIPE. Update this block to your env.
provider "aws" {
  alias  = "vipe"
  region = var.aws_region

  # Example assume-role into VIPE (uncomment and set a real role if needed)
  # assume_role {
  #   role_arn     = "arn:aws:iam::${var.vipe_aws_account_id}:role/Admin"
  #   session_name = "tf-vipe"
  # }
}

########################################
# Variables
########################################
variable "aws_region" {
  description = "AWS region (e.g., eu-west-1)"
  type        = string
  default     = "eu-west-1"
}

variable "aws_account_id" {
  description = "Source account ID (Lambda account)"
  type        = string
}

variable "vipe_aws_account_id" {
  description = "Target VIPE account ID (bucket account)"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, uat, prod)"
  type        = string
}

########################################
# Locals
########################################
locals {
  lambda_execution_role_arn = "arn:aws:iam::${var.aws_account_id}:role/${var.environment}-hearst_schedule_mapper-executionrole"
  lambda_role_name          = element(split("/", local.lambda_execution_role_arn), 1)

  vipe_bucket_name          = "uat-inbound-media-files-${var.vipe_aws_account_id}"

  # EXACT prefixes your code lists against (must match list_objects_v2 Prefix)
  done_prefix_folder        = "rt-demo/procschedules/ARQTV3/done/"
  done_prefix_objects       = "rt-demo/procschedules/ARQTV3/done/*"

  # Local/source bucket (where archive json goes)
  local_bucket_name         = "${var.environment}-playout-schedule-${var.aws_account_id}"
}

########################################
# Cross-account S3 access policy (in VIPE)
# - Allow ListBucket on the exact prefix your code uses (folder and folder/*)
# - Allow GetObject on processed files
# - Allow PutObject (+ ACL) for your uploads to rt-demo/schedules/*
########################################
data "aws_iam_policy_document" "vipe_s3_cross_account_policy" {
  # Bucket-level listing on the done/ prefix
  statement {
    sid     = "AllowListDonePrefix"
    effect  = "Allow"
    actions = ["s3:ListBucket"]
    resources = [
      "arn:aws:s3:::${local.vipe_bucket_name}"
    ]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values = [
        local.done_prefix_folder,
        local.done_prefix_objects
      ]
    }
  }

  # Object-level read on done path
  statement {
    sid     = "AllowGetDoneObjects"
    effect  = "Allow"
    actions = ["s3:GetObject"]
    resources = [
      "arn:aws:s3:::${local.vipe_bucket_name}/${local.done_prefix_objects}"
    ]
  }

  # Object-level write on schedules path (your upload)
  statement {
    sid     = "AllowPutSchedules"
    effect  = "Allow"
    actions = ["s3:PutObject", "s3:PutObjectAcl"]
    resources = [
      "arn:aws:s3:::${local.vipe_bucket_name}/rt-demo/schedules/*"
    ]
    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
  }
}

########################################
# Trust policy for the cross-account role (in VIPE)
# - Allows your Lambda execution role to assume it, with ExternalId guard
########################################
data "aws_iam_policy_document" "cross_account_assume_role_policy" {
  statement {
    sid     = "AllowAssumeFromSourceLambda"
    effect  = "Allow"
    principals {
      type        = "AWS"
      identifiers = [local.lambda_execution_role_arn]
    }
    actions = ["sts:AssumeRole"]

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = ["${var.environment}-vipe-access"]
    }
  }
}

########################################
# Local S3 operations policy (in SOURCE)
########################################
data "aws_iam_policy_document" "local_s3_policy" {
  statement {
    sid     = "LocalS3RW"
    effect  = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]
    resources = [
      "arn:aws:s3:::${local.local_bucket_name}",
      "arn:aws:s3:::${local.local_bucket_name}/*"
    ]
  }
}

########################################
# Cross-account role & policy (created in VIPE)
########################################
resource "aws_iam_role" "vipe_cross_account_role" {
  provider           = aws.vipe
  name               = "${var.environment}-vipe-cross-account-role"
  assume_role_policy = data.aws_iam_policy_document.cross_account_assume_role_policy.json

  tags = {
    Environment = var.environment
    Purpose     = "Cross-account access to VIPE S3 bucket for schedule ingest/polling"
  }
}

resource "aws_iam_policy" "vipe_s3_cross_account_policy" {
  provider    = aws.vipe
  name        = "${var.environment}-vipe-s3-cross-account-policy"
  description = "Policy for cross-account access to VIPE S3 bucket"
  policy      = data.aws_iam_policy_document.vipe_s3_cross_account_policy.json
}

resource "aws_iam_role_policy_attachment" "attach_vipe_policy" {
  provider  = aws.vipe
  role      = aws_iam_role.vipe_cross_account_role.name
  policy_arn = aws_iam_policy.vipe_s3_cross_account_policy.arn
}

########################################
# Lambda execution role policies (in SOURCE)
########################################
# Allow Lambda to assume the VIPE cross-account role
data "aws_iam_policy_document" "lambda_assume_cross_account_policy" {
  statement {
    sid     = "AllowAssumeVipeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    resources = [
      "arn:aws:iam::${var.vipe_aws_account_id}:role/${var.environment}-vipe-cross-account-role"
    ]
  }
}

resource "aws_iam_policy" "lambda_assume_cross_account_policy" {
  name        = "${var.environment}-lambda-assume-cross-account-policy"
  description = "Allow Lambda to assume cross-account role for VIPE access"
  policy      = data.aws_iam_policy_document.lambda_assume_cross_account_policy.json
}

# Allow Lambda to read/write the local/source bucket
resource "aws_iam_policy" "lambda_local_s3_policy" {
  name        = "${var.environment}-lambda-local-s3-policy"
  description = "Policy for Lambda to access local S3 bucket"
  policy      = data.aws_iam_policy_document.local_s3_policy.json
}

resource "aws_iam_role_policy_attachment" "attach_local_s3_policy" {
  role       = local.lambda_role_name
  policy_arn = aws_iam_policy.lambda_local_s3_policy.arn
}

resource "aws_iam_role_policy_attachment" "attach_assume_cross_account_policy" {
  role       = local.lambda_role_name
  policy_arn = aws_iam_policy.lambda_assume_cross_account_policy.arn
}

########################################
# Outputs
########################################
output "vipe_cross_account_role_arn" {
  description = "ARN of the cross-account role for VIPE bucket access (in VIPE account)"
  value       = aws_iam_role.vipe_cross_account_role.arn
}

output "lambda_assume_cross_account_policy_arn" {
  description = "ARN of the policy allowing Lambda to assume cross-account role"
  value       = aws_iam_policy.lambda_assume_cross_account_policy.arn
}

output "lambda_local_s3_policy_arn" {
  description = "ARN of the policy for local S3 access"
  value       = aws_iam_policy.lambda_local_s3_policy.arn
}
