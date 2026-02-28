CREATE TYPE "public"."bankruptcy_handling" AS ENUM('strict', 'forgiving');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('waiting', 'playing', 'finished');--> statement-breakpoint
CREATE TYPE "public"."room_type" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."turn_time_limit" AS ENUM('30', '60', 'unlimited');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kick_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"target_player_id" integer NOT NULL,
	"voter_id" integer NOT NULL,
	CONSTRAINT "kick_votes_room_id_target_player_id_voter_id_unique" UNIQUE("room_id","target_player_id","voter_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"socket_id" varchar NOT NULL,
	"room_id" integer NOT NULL,
	"username" varchar(20) NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"money" integer NOT NULL,
	"color" varchar(10) NOT NULL,
	"is_leader" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "players_room_id_user_id_unique" UNIQUE("room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"property_id" integer NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "properties_room_id_property_id_unique" UNIQUE("room_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "room_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"free_parking_money" boolean NOT NULL,
	"pass_go_money_amount" integer NOT NULL,
	"allow_trading" boolean NOT NULL,
	"allow_mortgaging_properties" boolean NOT NULL,
	"auction_properties" boolean NOT NULL,
	"speed_up_game_mode" boolean NOT NULL,
	"number_of_players" integer NOT NULL,
	"starting_money" integer NOT NULL,
	"allow_players_to_join_mid_game" boolean NOT NULL,
	"turn_time_limit" "turn_time_limit" NOT NULL,
	"auto_roll_dice_after_timeout" boolean NOT NULL,
	"bankruptcy_handling" "bankruptcy_handling" NOT NULL,
	"allow_chat" boolean NOT NULL,
	"game_ends_when_only_one_player_remains" boolean NOT NULL,
	CONSTRAINT "room_options_room_id_unique" UNIQUE("room_id")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_key" varchar(10) NOT NULL,
	"name" varchar(20) NOT NULL,
	"status" "room_status" DEFAULT 'waiting' NOT NULL,
	"type" "room_type" DEFAULT 'public' NOT NULL,
	"password" varchar(20),
	"current_turn" integer DEFAULT 1 NOT NULL,
	"rank_sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_room_key_unique" UNIQUE("room_key")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kick_votes" ADD CONSTRAINT "kick_votes_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kick_votes" ADD CONSTRAINT "kick_votes_target_player_id_players_id_fk" FOREIGN KEY ("target_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kick_votes" ADD CONSTRAINT "kick_votes_voter_id_players_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_options" ADD CONSTRAINT "room_options_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;