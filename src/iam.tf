########################################
# Providers (example)
########################################
# Default provider -> SOURCE account (where Lambda runs), e.g., 943412361827
provider "aws" {
  region = "eu-west-1"
}

# Aliased provider -> VIPE account (where bucket & cross-account role live), 980921750886
# Update 'assume_role' or credentials to match your setup.
provider "aws" {
  alias  = "vipe"
  region = "eu-west-1"

  # Example: Assume an admin role in VIPE. Replace with your mechanism.
  # assume_role {
  #   role_arn     = "arn:aws:iam::980921750886:role/Admin"
  #   session_name = "tf-vipe"
  # }
}

########################################
# Locals
########################################
locals {
  lambda_execution_role_arn = "arn:aws:iam::${var.aws_account_id}:role/${var.environment}-hearst_schedule_mapper-executionrole"
  lambda_role_name          = element(split("/", local.lambda_execution_role_arn), 1)
  vipe_bucket_name          = "uat-inbound-media-files-${var.vipe_aws_account_id}"
}

########################################
# Cross-account S3 access policy (VIPE)
########################################
data "aws_iam_policy_document" "vipe_s3_cross_account_policy" {
  # Bucket-level: allow listing only under the done prefix used by the poller.
  # Include BOTH the folder and folder/* to match the exact Prefix your code sends.
  statement {
    effect = "Allow"
    actions = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::${local.vipe_bucket_name}"]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = [
        "rt-demo/procschedules/ARQTV3/done/",
        "rt-demo/procschedules/ARQTV3/done/*"
      ]
    }
  }

  # Object-level: read the processed file(s) if needed
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = [
      "arn:aws:s3:::${local.vipe_bucket_name}/rt-demo/procschedules/ARQTV3/done/*"
    ]
  }

  # Object-level: uploads to schedules path (used during ingest)
  statement {
    effect = "Allow"
    actions = ["s3:PutObject", "s3:PutObjectAcl"]
    resources = [
      "arn:aws:s3:::${local.vipe_bucket_name}/rt-demo/schedules/*"
    ]
  }
}

########################################
# Trust policy for the cross-account role (VIPE)
########################################
data "aws_iam_policy_document" "cross_account_assume_role_policy" {
  statement {
    effect = "Allow"
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
# Local S3 operations policy (SOURCE)
########################################
data "aws_iam_policy_document" "local_s3_policy" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ]
    resources = [
      "arn:aws:s3:::${var.environment}-playout-schedule-${var.aws_account_id}",
      "arn:aws:s3:::${var.environment}-playout-schedule-${var.aws_account_id}/*"
    ]
  }
}

########################################
# Cross-account role & policy in VIPE
########################################
resource "aws_iam_role" "vipe_cross_account_role" {
  provider           = aws.vipe
  name               = "${var.environment}-vipe-cross-account-role"
  assume_role_policy = data.aws_iam_policy_document.cross_account_assume_role_policy.json

  tags = {
    Environment = var.environment
    Purpose     = "Cross-account access to VIPE S3 bucket"
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
# Lambda execution role policies (SOURCE)
########################################
data "aws_iam_policy_document" "lambda_assume_cross_account_policy" {
  statement {
    effect = "Allow"
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
  description = "ARN of the cross-account role for VIPE bucket access"
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
