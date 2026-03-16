import {
	boolean,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
	varchar,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────

export const roomStatusEnum = pgEnum("room_status", [
	"waiting",
	"playing",
	"finished",
]);

export const roomTypeEnum = pgEnum("room_type", ["public", "private"]);

// ── Rooms ──────────────────────────────────────────────────────

export const rooms = pgTable("rooms", {
	id: serial().primaryKey(),
	roomKey: varchar("room_key", { length: 10 }).unique().notNull(),
	name: varchar({ length: 20 }).notNull(),
	status: roomStatusEnum().default("waiting").notNull(),
	type: roomTypeEnum().default("public").notNull(),
	password: text(),
	currentTurn: integer("current_turn").default(1).notNull(),
	rankSequence: integer("rank_sequence").default(0).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Players ────────────────────────────────────────────────────

export const players = pgTable(
	"players",
	{
		id: serial().primaryKey(),
		userId: varchar("user_id").notNull(),
		socketId: varchar("socket_id").notNull(),
		roomId: integer("room_id")
			.references(() => rooms.id, { onDelete: "cascade" })
			.notNull(),
		username: varchar({ length: 20 }).notNull(),
		rank: integer().default(0).notNull(),
		position: integer().default(0).notNull(),
		money: integer().notNull(),
		color: varchar({ length: 10 }).notNull(),
		isLeader: boolean("is_leader").default(false).notNull(),
		joinedAt: timestamp("joined_at").defaultNow().notNull(),
	},
	(t) => [unique().on(t.roomId, t.userId)],
);

// ── Properties ─────────────────────────────────────────────────

export const properties = pgTable(
	"properties",
	{
		id: serial().primaryKey(),
		roomId: integer("room_id")
			.references(() => rooms.id, { onDelete: "cascade" })
			.notNull(),
		playerId: integer("player_id")
			.references(() => players.id, { onDelete: "cascade" })
			.notNull(),
		propertyId: integer("property_id").notNull(),
		rank: integer().default(0).notNull(),
	},
	(t) => [unique().on(t.roomId, t.propertyId)],
);

// ── Chat Messages ──────────────────────────────────────────────

export const chatMessages = pgTable("chat_messages", {
	id: serial().primaryKey(),
	roomId: integer("room_id")
		.references(() => rooms.id, { onDelete: "cascade" })
		.notNull(),
	playerId: integer("player_id")
		.references(() => players.id, { onDelete: "cascade" })
		.notNull(),
	message: text().notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Kick Votes ─────────────────────────────────────────────────

export const kickVotes = pgTable(
	"kick_votes",
	{
		id: serial().primaryKey(),
		roomId: integer("room_id")
			.references(() => rooms.id, { onDelete: "cascade" })
			.notNull(),
		targetPlayerId: integer("target_player_id")
			.references(() => players.id, { onDelete: "cascade" })
			.notNull(),
		voterId: integer("voter_id")
			.references(() => players.id, { onDelete: "cascade" })
			.notNull(),
	},
	(t) => [unique().on(t.roomId, t.targetPlayerId, t.voterId)],
);

// ── Room Access ─────────────────────────────────────────────────

export const roomAccess = pgTable(
	"room_access",
	{
		id: serial().primaryKey(),
		roomId: integer("room_id")
			.references(() => rooms.id, { onDelete: "cascade" })
			.notNull(),
		userId: varchar("user_id").notNull(),
	},
	(t) => [unique().on(t.roomId, t.userId)],
);
