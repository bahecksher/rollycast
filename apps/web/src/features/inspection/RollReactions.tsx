import { useLocalRoller } from '../../state/localRoller';
import { useRoomStore } from '../../state/roomStore';
import { reactionPresentation } from './reactionCatalog';

export function RollReactions() {
  const reactions = useLocalRoller((s) => s.reactions);
  const players = useRoomStore((s) => s.players);

  return (
    <div className="roll-reactions" aria-live="polite" aria-label="Roll reactions">
      {reactions.map((reaction) => {
        const presentation = reactionPresentation(reaction.reaction);
        const player = players.find((candidate) => candidate.id === reaction.playerId);
        return (
          <div className="roll-reaction" key={reaction.id}>
            <span aria-hidden="true">{presentation.symbol}</span>
            <strong>{presentation.label}</strong>
            {player && <small>{player.displayName}</small>}
          </div>
        );
      })}
    </div>
  );
}
