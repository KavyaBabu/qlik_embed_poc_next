locals {
  # Automatically load environment-level variables
  environment_vars = read_terragrunt_config(find_in_parent_folders("environment.hcl"))

  # Extract out common variables for reuse
  account_id       = local.environment_vars.locals.aws_account_id
  vipe_aws_account_id = local.environment_vars.locals.vipe_aws_account_id
}

include "root" {
  path = find_in_parent_folders()
}

dependencies {
  paths = ["../network"]
}

terraform {
  source = "../../../modules/lambdas"
}

include "envcommon" {
  path   = "${dirname(find_in_parent_folders())}/_envcommon/lambdas.hcl"
  expose = true
}

dependency "network" {
  enabled     = false
  config_path = "../network"
}

dependency "environment_initial" {
  config_path = "../environment_initial"
}

inputs = {
  lambdas =[
    {
      lambda_name               = "cognito_pre_token_generation"
      source_dir                = ""
      lambda_runtime            = "python3.12"
      lambda_timeout_secs       = 10
      provision_inside_vpc      = false
      call_from_api             = false
      ephemeral_storage         = 512
      memory_size               = 128
      ip_allow_list             = ""
      layer_arns                = [
      ]
      local_layer_names         = [
      ]
      policy_arns               = [
      ]
      environment_variables     = [
        {
          name  = "COMMON_SCOPE_PREFIX"
          value = "api.ail-dev.arqiva-cs.com"
        },
        {
          name  = "COMMON_ADMIN_SCOPES"
          value = "workOrder:read:admin,destination:read:admin,provider:read:admin,sourceFile:read:admin,generatedFile:read:admin,job:read:admin,workOrder:restart:admin,task:read:admin,task:write:admin"
        },
        {
          name  = "COMMON_USER_SCOPES"
          value = "workOrder:read,destination:read,provider:read,sourceFile:read,generatedFile:read,job:read,task:read,task:write"
        },
        {
          name  = "CUSTOMER_SCOPE_PREFIX_1"
          value = "vod4-dev-hearst.arqiva-cs.com"
        },
        {
          name  = "CUSTOMER_ADMIN_SCOPES_1"
          value = "schedule:list:admin,schedule:get:admin"
        },
        {
          name  = "CUSTOMER_USER_SCOPES_1"
          value = "schedule:list,schedule:get"
        },
      ]
    },
    {
      lambda_name               = "get_docs_json"
      source_dir                = "get_docs_json"
      lambda_runtime            = "python3.12"
      lambda_timeout_secs       = 10
      provision_inside_vpc      = false
      call_from_api             = true
      ephemeral_storage         = 512
      memory_size               = 256
      ip_allow_list             = ""
      layer_arns                = [
      ]
      local_layer_names         = [
      ]
      policy_arns               = [
      ]
      environment_variables     = [
      ]
    },
    {
      lambda_name               = "work_order_list"
      source_dir                = "work_order_list"
      lambda_runtime            = "python3.12"
      lambda_timeout_secs       = 10
      provision_inside_vpc      = true
      call_from_api             = false
      ephemeral_storage         = 512
      memory_size               = 256
      ip_allow_list             = ""
      layer_arns                = [
        "arn:aws:lambda:eu-west-1:017000801446:layer:AWSLambdaPowertoolsPythonV3-python312-arm64:3",
      ]
      local_layer_names         = [
        "common",
        "playout_data_layer",
      ]
      policy_arns               = [
      ]
      environment_variables     = [
        {
          name  = "DB_SECRET_ARN"
          value = "arn:aws:secretsmanager:eu-west-1:943412361827:secret:/database/dev/base/master_credentials-5gtulW"
        },
        {
          name  = "DB_PROXY_ENDPOINT"
          value = "dev-base-playout-aurora.cluster-clqeoqmuuyhc.eu-west-1.rds.amazonaws.com"
        },
        {
          name  = "DB_NAME"
          value = "playout_dev_db_provisioned"
        },
      ]
    },
    {
      lambda_name               = "work_order_create"
      source_dir                = "work_order_create"
      lambda_runtime            = "python3.12"
      lambda_timeout_secs       = 10
      provision_inside_vpc      = true
      call_from_api             = false
      ephemeral_storage         = 512
      memory_size               = 256
      ip_allow_list             = ""
      layer_arns                = [
      ]
      local_layer_names         = [
        "common",
        "playout_data_layer",
      ]
      policy_arns               = [
      ]
      environment_variables     = [
        {
          name  = "DB_SECRET_ARN"
          value = "arn:aws:secretsmanager:eu-west-1:943412361827:secret:/database/dev/base/master_credentials-5gtulW"
        },
        {
          name  = "DB_PROXY_ENDPOINT"
          value = "dev-base-playout-aurora.cluster-clqeoqmuuyhc.eu-west-1.rds.amazonaws.com"
        },
        {
          name  = "DB_NAME"
          value = "playout_dev_db_provisioned"
        },
      ]
    },
    {
      lambda_name               = "work_order_by_id"
      source_dir                = "work_order_by_id"
      lambda_runtime            = "python3.12"
      lambda_timeout_secs       = 10
      provision_inside_vpc      = true
      call_from_api             = true
      ephemeral_storage         = 512
      memory_size               = 256
      ip_allow_list             = ""
      layer_arns                = [
      ]
      local_layer_names         = [
        "common",
        "playout_data_layer",
      ]
      policy_arns               = [
      ]
      environment_variables     = [
        {
          name  = "DB_SECRET_ARN"
          value = "arn:aws:secretsmanager:eu-west-1:943412361827:secret:/database/dev/base/master_credentials-5gtulW"
        },
        {
          name  = "DB_PROXY_ENDPOINT"
          value = "dev-base-playout-aurora.cluster-clqeoqmuuyhc.eu-west-1.rds.amazonaws.com"
        },
        {
          name  = "DB_NAME"
          value = "playout_dev_db_provisioned"
        },
      ]
    },
    {
      lambda_name               = "hearst_schedule_mapper"
      source_dir                = "hearst_schedule_mapper"
      lambda_runtime            = "python3.12"
      lambda_timeout_secs       = 30
      provision_inside_vpc      = true
      call_from_api             = true
      ephemeral_storage         = 1024
      memory_size               = 512
      ip_allow_list             = ""
      layer_arns                = [
      ]
      local_layer_names         = [
        "schedules",
        "common",
        "playout_data_layer",
      ]
      policy_arns               = [
      ]
      environment_variables     = [
        {
          name  = "VIPE_CROSS_ACCOUNT_ID"
          value = "980921750886"
        },
        {
          name  = "VIPE_CROSS_ACCOUNT_ROLE_NAME"
          value = "vipe-cross-account-role"
        },
        {
          name  = "VIPE_CROSS_ACCOUNT_EXTERNAL_ID"
          value = "vipe-access"
        },
        {
          name  = "DB_SECRET_ARN"
          value = "arn:aws:secretsmanager:eu-west-1:943412361827:secret:/database/dev/base/master_credentials-5gtulW"
        },
        {
          name  = "DB_PROXY_ENDPOINT"
          value = "dev-base-playout-aurora.cluster-clqeoqmuuyhc.eu-west-1.rds.amazonaws.com"
        },
        {
          name  = "DB_NAME"
          value = "playout_dev_db_provisioned"
        },
      ]
    },
  ]
  

  dedicated_network  = false
  inherited_network = "dev"
  private_subnet_az_1 = ""
  lambda_security_group = ""


  base_dir              = "${get_env("CODEBUILD_SRC_DIR")}"
  cors_allowed_origin = "http://localhost:8080"
  vipe_aws_account_id = local.vipe_aws_account_id
  
}
