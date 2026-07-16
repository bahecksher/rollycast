import type { RollReaction } from '@rollycast/shared';
import { useLocalRoller } from '../../state/localRoller';
import { useRoomStore } from '../../state/roomStore';

const REACTION_LABELS: Record<RollReaction, { symbol: string; label: string }> = {
  critical: { symbol: '★', label: 'Critical!' },
  success: { symbol: '✓', label: 'Success' },
  disaster: { symbol: '!', label: 'Disaster' },
  suspense: { symbol: '…', label: 'Suspense' },
  applause: { symbol: '👏', label: 'Applause' },
  question: { symbol: '?', label: 'Question' },
};

export function RollReactions() {
  const reactions = useLocalRoller((s) => s.reactions);
  const players = useRoomStore((s) => s.players);

  return (
    <div className="roll-reactions" aria-live="polite" aria-label="Roll reactions">
      {reactions.map((reaction) => {
        const presentation = REACTION_LABELS[reaction.reaction];
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
