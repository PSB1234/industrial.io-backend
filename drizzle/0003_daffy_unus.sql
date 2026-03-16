CREATE TABLE "room_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	CONSTRAINT "room_access_room_id_user_id_unique" UNIQUE("room_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "room_access" ADD CONSTRAINT "room_access_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;