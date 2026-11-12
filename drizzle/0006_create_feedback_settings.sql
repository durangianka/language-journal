CREATE TABLE "feedback_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"tone" text DEFAULT 'formal' NOT NULL,
	"address" text DEFAULT 'neutral' NOT NULL,
	"learner_gender" text DEFAULT 'unspecified' NOT NULL,
	CONSTRAINT "feedback_settings_single_learner" CHECK ("feedback_settings"."id" = 1),
	CONSTRAINT "feedback_settings_tone_valid" CHECK ("feedback_settings"."tone" in ('formal', 'friendly', 'slang')),
	CONSTRAINT "feedback_settings_address_valid" CHECK ("feedback_settings"."address" in ('neutral', 'bro', 'sis')),
	CONSTRAINT "feedback_settings_gender_valid" CHECK ("feedback_settings"."learner_gender" in ('unspecified', 'female', 'male'))
);
