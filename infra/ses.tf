# SES Email Identity
# Note: This creates an email identity that must be verified before use.
# In production, you would verify a domain instead of an individual email.

resource "aws_ses_email_identity" "sender" {
  email = var.ses_email_sender
}

# SES Configuration Set for tracking email metrics
resource "aws_ses_configuration_set" "main" {
  name = "${local.resource_prefix}-email-config"
}

# CloudWatch event destination for SES metrics
resource "aws_ses_event_destination" "cloudwatch" {
  name                   = "cloudwatch-destination"
  configuration_set_name = aws_ses_configuration_set.main.name
  enabled                = true
  matching_types         = ["send", "bounce", "complaint", "delivery", "reject"]

  cloudwatch_destination {
    default_value  = "default"
    dimension_name = "ses:configuration-set"
    value_source   = "messageTag"
  }
}

# Note: After applying, you must verify the email address by clicking
# the confirmation link sent to var.ses_email_sender
#
# For production, verify a domain instead:
# resource "aws_ses_domain_identity" "main" {
#   domain = "yourdomain.com"
# }
#
# resource "aws_ses_domain_dkim" "main" {
#   domain = aws_ses_domain_identity.main.domain
# }
#
# Then add the DKIM records to your DNS provider
