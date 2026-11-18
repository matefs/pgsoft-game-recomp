import { existsSync } from "fs"
import path from "path"

export const gameCatalog = [
   { game_id: 69, game_code: "bikine-paradise", name: "Bikini Paradise" },
   { game_id: 125, game_code: "butterfly-blossom", name: "Butterfly Blossom" },
   { game_id: 1682240, game_code: "cash-mania", name: "Cash Mania" },
   { game_id: 1738001, game_code: "chicky-run", name: "Chicky Run" },
   { game_id: 48, game_code: "double-fortune", name: "Double Fortune" },
   { game_id: 63, game_code: "dragon-tiger-luck", name: "Dragon Tiger Luck" },
   { game_id: 1695365, game_code: "fortune-dragon", name: "Fortune Dragon" },
   { game_id: 68, game_code: "fortune-mouse", name: "Fortune Mouse" },
   { game_id: 98, game_code: "fortune-ox", name: "Fortune Ox" },
   { game_id: 1543462, game_code: "fortune-rabbit", name: "Fortune Rabbit" },
   { game_id: 126, game_code: "fortune-tiger", name: "Fortune Tiger" },
   { game_id: 42, game_code: "ganesha-gold", name: "Ganesha Gold" },
   { game_id: 91, game_code: "gdn-ice-fire", name: "Guardians of Ice & Fire" },
   { game_id: 40, game_code: "jungle-delight", name: "Jungle Delight" },
   { game_id: 1601012, game_code: "lucky-clover", name: "Lucky Clover Lady" },
   { game_id: 95, game_code: "majestic-ts", name: "Majestic Treasures" },
   { game_id: 1529867, game_code: "ninja-raccoon", name: "Ninja Raccoon Frenzy" },
   { game_id: 39, game_code: "piggy-gold", name: "Piggy Gold" },
   { game_id: 1312883, game_code: "prosper-ftree", name: "Prosperity Fortune Tree" },
   { game_id: 101, game_code: "rise-apollo", name: "Rise Of Apollo" },
   { game_id: 67, game_code: "shaolin-soccer", name: "Shaolin Soccer" },
   { game_id: 92, game_code: "thai-river", name: "Thai River Wonders" },
   { game_id: 1727711, game_code: "three-cz-pigs", name: "Three Crazy Piggies" },
   { game_id: 87, game_code: "treasures-aztec", name: "Treasures of Aztec" },
   { game_id: 1489936, game_code: "ultimate-striker", name: "Ultimate Striker" },
   { game_id: 104, game_code: "wild-bandito", name: "Wild Bandito" },
   { game_id: 135, game_code: "wild-bounty-sd", name: "Wild Bounty Showdown" },
   { game_id: 1747549, game_code: "wings-iguazu", name: "Wings of Iguazu" },
   { game_id: 1635221, game_code: "zombie-outbreak", name: "Zombie Outbreak" },
] as const

export function gameById(gameId: string) {
   return gameCatalog.find(game => String(game.game_id) === gameId)
}

export function gameByCode(gameCode: string) {
   const routeCode = gameCode === "bikini-paradise" ? "bikine-paradise" : gameCode
   return gameCatalog.find(game => game.game_code === routeCode)
}

const requiredResources: Partial<Record<number, string[]>> = {
   // Imports requested during the Wild Bounty Showdown startup.
   135: ["09/096d9f0aa.067c6.json", "0e/0e4f073a3.7650b.json", "0a/0ab40b454.9fd26.json", "0d/0d968d109.6293c.json", "02/023894b60.041b4.json"],
}

export function gameUnavailableReason(gameId: number) {
   const directory = path.resolve(__dirname, "../dist/public", String(gameId))
   if (!existsSync(path.join(directory, "index.html"))) {
      return "Página do jogo ausente nesta instalação."
   }
   if (requiredResources[gameId]?.some(file => !existsSync(path.join(directory, "assets/resources/import", file)))) {
      return "Faltam arquivos necessários para o carregamento do jogo."
   }
}
