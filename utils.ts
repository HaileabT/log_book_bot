export function extractAllUserOrDefault(match: string) {
    let recentAmount = 5;
    let username = "";
    let isAll = false;
    let isUser = false;

    if (match && match.trim() !== "") {
        const parts = match.trim().split(/\s+/);
        if (parts[0]?.toLowerCase() === "all") {
            isAll = true;
            if (parts[1] && !isNaN(Number(parts[1]))) {
                recentAmount = parseInt(parts[1], 10);
            }
        } else if (parts[0]?.startsWith("@")) {
            isUser = true;
            username = parts[0].slice(1);
            if (parts[1] && !isNaN(Number(parts[1]))) {
                recentAmount = parseInt(parts[1], 10);
            }
        } else if (!isNaN(Number(parts[0]))) {
            recentAmount = parseInt(parts[0]!, 10);
        }
    }

    return { isAll, isUser, username, recentAmount }
}