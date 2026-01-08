import { addVote, getVotes, clearRoomVotes } from "./lib/kick_storage";

const roomKey = "test_room";
const target1 = "target_1";
const target2 = "target_2";
const voterA = "voter_A";
const voterB = "voter_B";

console.log("Starting Verification...");

// Cleanup
clearRoomVotes(roomKey);

// Test 1: Voter A votes for Target 1
addVote(roomKey, target1, voterA);
let votes = getVotes(roomKey, target1);
if (votes !== 1) {
    console.error(`[FAIL] Test 1: Expected 1 vote, got ${votes}`);
    process.exit(1);
} else {
    console.log("[PASS] Test 1: Voter A voted (Count: 1)");
}

// Test 2: Voter A votes for Target 1 AGAIN
addVote(roomKey, target1, voterA);
votes = getVotes(roomKey, target1);
if (votes !== 1) {
    console.error(`[FAIL] Test 2: Expected 1 vote (deduplicated), got ${votes}`);
    process.exit(1);
} else {
    console.log("[PASS] Test 2: Voter A voted again (Count still 1)");
}

// Test 3: Voter B votes for Target 1
addVote(roomKey, target1, voterB);
votes = getVotes(roomKey, target1);
if (votes !== 2) {
    console.error(`[FAIL] Test 3: Expected 2 votes, got ${votes}`);
    process.exit(1);
} else {
    console.log("[PASS] Test 3: Voter B voted (Count: 2)");
}

// Test 4: Voter A votes for Target 2 (Independent)
addVote(roomKey, target2, voterA);
votes = getVotes(roomKey, target2);
if (votes !== 1) {
    console.error(`[FAIL] Test 4: Expected 1 vote for Target 2, got ${votes}`);
    process.exit(1);
} else {
    console.log("[PASS] Test 4: Voter A voted for Target 2 (Count: 1)");
}

console.log("All verification tests passed!");
