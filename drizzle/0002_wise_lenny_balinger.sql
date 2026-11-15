ALTER TABLE "scores" ADD COLUMN "horizon" text DEFAULT '2m' NOT NULL;--> statement-breakpoint
DROP INDEX "scores_as_of_idx";--> statement-breakpoint
ALTER TABLE "scores" DROP CONSTRAINT "scores_symbol_as_of_pk";--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_symbol_as_of_horizon_pk" PRIMARY KEY("symbol","as_of","horizon");--> statement-breakpoint
CREATE INDEX "scores_as_of_idx" ON "scores" USING btree ("as_of","horizon");
