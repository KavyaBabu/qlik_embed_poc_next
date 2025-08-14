locals {
  lambda_execution_role_arn = "arn:aws:iam::${var.aws_account_id}:role/${var.environment}-hearst_schedule_mapper-executionrole"
  lambda_role_name          = element(split("/", local.lambda_execution_role_arn), 1)
  vipe_bucket_name          = "uat-inbound-media-files-${var.vipe_aws_account_id}"
}

# Policy for cross-account S3 access to VIPE bucket
data "aws_iam_policy_document" "vipe_s3_cross_account_policy" {
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:PutObjectAcl",
      "s3:GetObject",
      "s3:ListBucket"
    ]
    resources = [
      "arn:aws:s3:::${local.vipe_bucket_name}",
      "arn:aws:s3:::${local.vipe_bucket_name}/*"
    ]
  }
}

# Trust policy for the cross-account role
data "aws_iam_policy_document" "cross_account_assume_role_policy" {
  statement {
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.aws_account_id}:role/dev-hearst_schedule_mapper-executionrole"]
    }
    actions = ["sts:AssumeRole"]

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = ["${var.environment}-vipe-access"]
    }
  }
}

# Policy for local S3 operations 
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

# Cross-account role for accessing VIPE bucket
resource "aws_iam_role" "vipe_cross_account_role" {
  name               = "${var.environment}-vipe-cross-account-role"
  assume_role_policy = data.aws_iam_policy_document.cross_account_assume_role_policy.json

  tags = {
    Environment = var.environment
    Purpose     = "Cross-account access to VIPE S3 bucket"
  }
}

# Policy for VIPE bucket access
resource "aws_iam_policy" "vipe_s3_cross_account_policy" {
  name        = "${var.environment}-vipe-s3-cross-account-policy"
  description = "Policy for cross-account access to VIPE S3 bucket"
  policy      = data.aws_iam_policy_document.vipe_s3_cross_account_policy.json
}

# Attach VIPE policy to cross-account role
resource "aws_iam_role_policy_attachment" "attach_vipe_policy" {
  role       = aws_iam_role.vipe_cross_account_role.name
  policy_arn = aws_iam_policy.vipe_s3_cross_account_policy.arn
}

# Lambda execution role with assume role permissions
data "aws_iam_policy_document" "lambda_assume_cross_account_policy" {
  statement {
    effect = "Allow"
    actions = [
      "sts:AssumeRole"
    ]
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

# Policy for Lambda to access local S3 bucket
resource "aws_iam_policy" "lambda_local_s3_policy" {
  name        = "${var.environment}-lambda-local-s3-policy"
  description = "Policy for Lambda to access local S3 bucket"
  policy      = data.aws_iam_policy_document.local_s3_policy.json
}

# Attach local S3 policy to Lambda execution role
resource "aws_iam_role_policy_attachment" "attach_local_s3_policy" {
  role       = local.lambda_role_name
  policy_arn = aws_iam_policy.lambda_local_s3_policy.arn
}

# Attach assume role policy to Lambda execution role
resource "aws_iam_role_policy_attachment" "attach_assume_cross_account_policy" {
  role       = local.lambda_role_name
  policy_arn = aws_iam_policy.lambda_assume_cross_account_policy.arn
}

# Outputs
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
