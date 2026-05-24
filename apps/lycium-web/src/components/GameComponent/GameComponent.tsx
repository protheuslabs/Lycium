type GameData = {
  name?: string;
};

export default function GameComponent({ gameData }: { gameData: GameData }) {
  return (
    <div className="game-block">
      <p>Game placeholder: {gameData.name ?? "Unnamed game"}</p>
    </div>
  );
}
