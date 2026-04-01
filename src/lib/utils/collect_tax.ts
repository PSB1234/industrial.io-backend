import { getPlayerMoney } from "@/db/queries/player";
import { getPlayerProperties } from "@/db/queries/property";

export async function collectTaxFromPlayer(userId: string, roomId: number): number {
    const totalPropertiesOwnedByPlayer = (await getPlayerProperties(roomId, userId)).size;
    const taxPercentageList = [10, 20, 30, 40, 50, 60];
    let index = Math.floor(totalPropertiesOwnedByPlayer / 4);
    index = Math.min(index, taxPercentageList.length - 1);
    const taxPercentage = taxPercentageList[index]!;
    const moneyOwnedByPlayer = await getPlayerMoney(roomId, userId);
    const finalAmount = (moneyOwnedByPlayer * taxPercentage) / 100;
    return finalAmount;
}