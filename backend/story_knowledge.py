"""What the story allows NPCs to know, and when.

This is data plus a few pure helpers; nothing here touches the network or the game.

Restriction works by omission. A fact is only ever shown to the model once it is *unlocked* by the
chapter and by what the player has actually done. A locked fact's text is not sent at all, so the
model cannot leak it. Locked topics are listed only under a generic label (never the fact itself).
`leak_patterns` are a second line of defence on the reply.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# The label shown for anything locked by chapter. Deliberately says nothing about the content.
FUTURE_TOPIC = "anything about events later in the story that have not happened yet"

CHAPTER_TITLES = {
    1: "Welcome to Olympus",
    2: "The Secrets of the Gods",
    3: "The Forbidden Vault",
    4: "The Betrayal",
    5: "Guardian of Olympus",
}

# Human-readable descriptions of the ids the game may send. Anything NOT listed here is ignored:
# the story context is untrusted, so unknown strings never reach the model.
QUEST_DESCRIPTIONS = {
    "chapter1": "arrived at Olympus and put the gatekeeper to sleep",
    "sealOfWisdom": "solved Athena's puzzle and earned the Seal of Wisdom",
    "sealOfCourage": "crossed Ares's training arena and earned the Seal of Courage",
    "sealOfPassage": "answered Hades's questions and earned the Seal of Passage",
    "chapter2": "gathered all three seals and opened the way to Zeus's palace",
    "chapter3": "escaped Zeus's palace with the Master Lightning Bolt",
    "chapter4": "was betrayed by Aphrodite and freed from her necklace by Athena and Ares",
    "chapter5": "restored Olympus and was named its Guardian",
}
CLUE_DESCRIPTIONS = {
    "gatekeeperRumor": "has heard a rumor that an ancient incantation can put the gatekeeper to sleep",
    "incantation": "has learned the gatekeeper's sleeping incantation",
    "statueWarning": "has read the glowing statue's warning at the entrance",
}
ITEM_DESCRIPTIONS = {
    "masterLightningBolt": "is carrying Zeus's Master Lightning Bolt",
    "aphroditeNecklace": "wears a necklace that Aphrodite gave them",
}
FLAG_DESCRIPTIONS = {
    "aphroditeIntroComplete": "has spoken with Aphrodite",
    "gatekeeperRumorHeard": "has heard the rumor about the gatekeeper",
    "incantationLearned": "knows the gatekeeper's incantation",
    "statueExamined": "has examined the warning statue",
    "gatekeeperAsleep": "the gatekeeper Argos is fast asleep",
    "gateOpen": "the gate of Olympus is open",
    "athenaIntroComplete": "has spoken with Athena about the seals",
    "wisdomPuzzleSolved": "has solved Athena's puzzle",
    "aresIntroComplete": "has spoken with Ares",
    "aresTrainingComplete": "has finished Ares's training arena",
    "hadesTrialComplete": "has finished Hades's questions",
    "palaceEntered": "has entered Zeus's palace",
    "statuePuzzleSolved": "has solved the pressure-plate puzzle in the palace",
    "guardsPassed": "has passed the palace guards",
    "vaultOpen": "has opened Zeus's vault",
    "zeusConfrontationComplete": "has finished the confrontation with Zeus",
    "aphroditeConfronted": "has met Aphrodite again outside Zeus's palace",
    "boltSurrendered": "has given up the Master Lightning Bolt to Aphrodite",
    "betrayalRevealed": "Aphrodite has revealed that she manipulated the mortal all along",
    "zeusImprisoned": "Aphrodite has imprisoned Zeus with his own lightning",
    "playerRescued": "Athena and Ares have freed the mortal from Aphrodite's necklace",
    "enchantmentsBroken": "the mortal has broken Aphrodite's three enchantments and reached the throne room",
    "aphroditeYielded": "Aphrodite has set down the Master Lightning Bolt",
    "zeusFreed": "the mortal has freed Zeus from his golden cage",
    "boltReturned": "the mortal has returned the Master Lightning Bolt to Zeus",
}
SEAL_NAMES = {"athena": "Seal of Wisdom", "ares": "Seal of Courage", "hades": "Seal of Passage"}


@dataclass(frozen=True)
class Progress:
    """The parts of the untrusted story context the rules look at."""

    chapter: int
    seals: frozenset[str] = frozenset()
    clues: frozenset[str] = frozenset()
    inventory: frozenset[str] = frozenset()
    quests: frozenset[str] = frozenset()
    flags: frozenset[str] = frozenset()


@dataclass(frozen=True)
class Fact:
    """One piece of knowledge, locked until the chapter and the player's progress allow it."""

    text: str  # sent to the model ONLY when unlocked
    topic: str = FUTURE_TOPIC  # what is shown to the model while locked
    min_chapter: int = 1
    requires_seals: tuple[str, ...] = ()
    requires_clues: tuple[str, ...] = ()
    requires_inventory: tuple[str, ...] = ()
    requires_quests: tuple[str, ...] = ()
    requires_flags: tuple[str, ...] = ()
    # From this chapter on, `requires_flags` no longer apply (the event is simply in the past by then).
    flags_waived_from_chapter: int | None = None
    # Regexes (case-insensitive) that must not appear in a reply while the fact is LOCKED.
    leak_patterns: tuple[str, ...] = ()
    # Regexes that must never appear in this character's replies, locked or not (e.g. a puzzle solution).
    never_say: tuple[str, ...] = ()

    def unlocked(self, progress: Progress) -> bool:
        return (
            progress.chapter >= self.min_chapter
            and all(s in progress.seals for s in self.requires_seals)
            and all(c in progress.clues for c in self.requires_clues)
            and all(i in progress.inventory for i in self.requires_inventory)
            and all(q in progress.quests for q in self.requires_quests)
            and (
                all(f in progress.flags for f in self.requires_flags)
                or (self.flags_waived_from_chapter is not None and progress.chapter >= self.flags_waived_from_chapter)
            )
        )


# --- facts every character may know, as the story unfolds -------------------------------------------

WORLD_FACTS: tuple[Fact, ...] = (
    Fact("Mount Olympus is the home of the gods. Zeus rules it and keeps the Master Lightning Bolt."),
    Fact(
        "A mortal from another world has arrived at Olympus. It is said, mostly by Aphrodite, that Zeus has become "
        "dangerous. That is a claim, not an established fact."
    ),
    Fact(
        "Zeus's vault is sealed by three magical seals: the Seal of Wisdom (Athena), the Seal of Courage (Ares) "
        "and the Seal of Passage (Hades). All three are needed to open it.",
        min_chapter=2,
    ),
    Fact(
        "The vault lies inside Zeus's palace. Palace guards let through only those who carry Ares's warrior badge, "
        "which is the Seal of Courage.",
        min_chapter=3,
    ),
    Fact(
        "At the entrance to Olympus stands a glowing statue with an old warning: 'Beware the goddess whose kindness "
        "conceals ambition. Her gift shall become your ...' The last word is worn away.",
        topic="the inscription on the glowing statue",
        requires_clues=("statueWarning",),
    ),
    # Future plot. The betrayal happens partway through Chapter 4, so during that chapter these unlock only
    # once the game reports it (flag `betrayalRevealed`); from Chapter 5 on they are simply known.
    # Until then the model never sees the text.
    Fact(
        "Aphrodite betrays the mortal: she takes the Master Lightning Bolt for herself and imprisons Zeus.",
        min_chapter=4,
        requires_flags=("betrayalRevealed",),
        flags_waived_from_chapter=5,
        leak_patterns=(
            r"\baphrodite\b[^.!?]{0,60}\bbetray\w*|\bbetray\w*[^.!?]{0,60}\baphrodite\b",
            r"\bimprison(?:s|ed|ing)?\b[^.!?]{0,30}\bzeus\b|\bzeus\b[^.!?]{0,30}\bimprison(?:s|ed|ing)?\b",
            r"\baphrodite\b[^.!?]{0,60}\bsteal(?:s|ing)?\b[^.!?]{0,30}\bbolt\b",
            r"\bbetray(?:s|ed)?\s+you\b|\byou (?:have been|were|are being) betrayed\b",
        ),
    ),
    Fact(
        "The necklace Aphrodite gives the mortal is a tracking charm: she uses it to follow them.",
        min_chapter=4,
        requires_flags=("betrayalRevealed",),
        flags_waived_from_chapter=5,
        leak_patterns=(r"\btracking (?:necklace|charm|spell|enchantment|amulet|pendant)\b",),
    ),
)

# --- facts for individual characters ------------------------------------------------------------------

NPC_FACTS: dict[str, tuple[Fact, ...]] = {
    "aphrodite": (
        Fact(
            "The mortal has broken your three enchantments and stands before Zeus's throne, where you sit with his "
            "Master Lightning Bolt across your knees; Zeus is caged beside you. For ages Olympus prized thunder and "
            "treated love as an ornament, and you wanted, for once, to be obeyed. You are proud, wounded and "
            "defensive: argue back, and let real doubt show if the mortal's words land. But you never hand over the "
            "bolt or announce that you give up in conversation: what you finally do is not decided by talking.",
            min_chapter=5,
            requires_flags=("enchantmentsBroken",),
        ),
        Fact(
            "You told the mortal that Zeus has become dangerous and asked them to take his Master Lightning Bolt. "
            "You urge them to speak to the locals, and later to Athena, Ares and Hades, to win the three seals."
        ),
        Fact(
            "You gave the mortal a necklace as a gift.",
            requires_inventory=("aphroditeNecklace",),
        ),
    ),
    "athena": (
        Fact(
            "Your Seal of Wisdom is earned by solving the symbol puzzle in your library. You never give it for talk "
            "alone. You may point to the inscription ('Let wisdom guide peace; let courage stand before power.') but "
            "you never state the solution.",
            min_chapter=2,
            never_say=(r"\bowl\b[^.!?]{0,60}\bolive\b[^.!?]{0,60}\bshield\b[^.!?]{0,60}\b(?:lightning|bolt)\b",),
        ),
        Fact(
            "You are wary of Aphrodite's motives, though you have no proof.",
            min_chapter=2,
        ),
        Fact(
            "The mortal wears a necklace from Aphrodite. You sense an unfamiliar enchantment on it and warn them to be "
            "careful, but you cannot tell what it does.",
            min_chapter=2,
            requires_inventory=("aphroditeNecklace",),
        ),
    ),
    "ares": (
        Fact(
            "Your Seal of Courage is earned in your training arena: the mortal must cross it past three swinging "
            "hammers. You never give it for boasting alone.",
            min_chapter=2,
        ),
        Fact(
            "You gave the mortal the Seal of Courage. It is the warrior badge the palace guards respect.",
            min_chapter=2,
            requires_seals=("ares",),
        ),
    ),
    "hades": (
        Fact(
            "You grant the Seal of Passage only after hearing the mortal's reasoning. You asked why they would steal "
            "from your own brother Zeus, why Zeus deserves to lose his bolt, and who sent them.",
            min_chapter=2,
        ),
        Fact("You distrust Aphrodite's generosity, though you have no proof of anything.", min_chapter=2),
        Fact(
            "You have already granted the mortal the Seal of Passage.",
            min_chapter=2,
            requires_seals=("hades",),
        ),
    ),
    "zeus": (
        Fact(
            "You found the mortal in your vault holding your Master Lightning Bolt. Someone sent them. You doubt that "
            "Aphrodite's account of you as dangerous is honest, and you suspect the mortal is being used, but you do "
            "not know every detail and you refuse to tell everything at once.",
            min_chapter=3,
        ),
        Fact(
            "Aphrodite imprisoned you with your own bolt. The mortal broke her charms, won the bolt back, freed you and "
            "returned it. You have long distrusted mortals: they steal fire, break promises and forget the gods. Now "
            "you are weighing whether mortals deserve a place on Olympus again. Challenge the mortal's reasons and "
            "respond to what they actually say, but announce no decision, forgiveness or title in conversation: that "
            "is not decided by talking.",
            min_chapter=5,
            requires_flags=("boltReturned",),
            never_say=(r"\bguardian of olympus\b",),
        ),
        Fact(
            "You have let the mortal leave with the bolt, with a warning to remember that you told them first.",
            min_chapter=3,
            requires_flags=("zeusConfrontationComplete",),
        ),
    ),
    "theron": (
        Fact("Argos the gatekeeper has not slept in three hundred years, and he is proud of it."),
        Fact(
            "Your grandmother swore that an ancient incantation sends Argos straight to sleep. You never learned the "
            "words. Young Lyra, further up the road, collects that sort of thing.",
            topic="rumors about how to get past the gatekeeper",
            requires_clues=("gatekeeperRumor",),
        ),
    ),
    "lyra": (
        Fact("You write down every whisper on the mountain and love to talk about what you have collected."),
        Fact(
            'You know the gatekeeper\'s sleeping incantation. The exact words are: "Somnus, let the heavens dream." '
            "They must be said exactly, to Argos at the gate.",
            topic="the exact words of the gatekeeper's sleeping incantation",
            requires_clues=("incantation",),
            leak_patterns=(r"\bsomnus\b",),
        ),
    ),
    "gatekeeper": (
        Fact("No mortal enters Olympus without leave. You never open the gate because someone asked nicely."),
        Fact(
            "You are fast asleep. You answer only with snores.",
            requires_flags=("gatekeeperAsleep",),
        ),
    ),
}


def facts_for(npc_id: str) -> tuple[Fact, ...]:
    return WORLD_FACTS + NPC_FACTS.get(npc_id, ())


def unlocked_facts(npc_id: str, progress: Progress) -> list[Fact]:
    return [f for f in facts_for(npc_id) if f.unlocked(progress)]


def locked_topics(npc_id: str, progress: Progress) -> list[str]:
    """Generic labels of what is still off limits, without duplicates and without the facts themselves."""
    topics: list[str] = []
    for fact in facts_for(npc_id):
        if not fact.unlocked(progress) and fact.topic not in topics:
            topics.append(fact.topic)
    return topics


def leak_patterns(npc_id: str, progress: Progress) -> list[re.Pattern[str]]:
    """Patterns that must not appear in a reply, from every locked fact this character could mention."""
    return [
        re.compile(pattern, re.IGNORECASE)
        for fact in facts_for(npc_id)
        if not fact.unlocked(progress)
        for pattern in fact.leak_patterns
    ]


def never_say_patterns(npc_id: str) -> list[re.Pattern[str]]:
    """Patterns this character must never produce, whatever the progress."""
    return [re.compile(p, re.IGNORECASE) for fact in facts_for(npc_id) for p in fact.never_say]


def describe_progress(progress: Progress, unaware_of: frozenset[str] = frozenset()) -> list[str]:
    """Plain-language progress lines, built only from known ids (unknown ones are dropped).

    `unaware_of` lists ids this character cannot know about (e.g. the gatekeeper must not be told that
    the player has learned how to put him to sleep).
    """
    lines = [f"The mortal {QUEST_DESCRIPTIONS[q]}." for q in QUEST_DESCRIPTIONS if q in progress.quests and q not in unaware_of]
    lines += [f"The mortal {CLUE_DESCRIPTIONS[c]}." for c in CLUE_DESCRIPTIONS if c in progress.clues and c not in unaware_of]
    lines += [f"The mortal {ITEM_DESCRIPTIONS[i]}." for i in ITEM_DESCRIPTIONS if i in progress.inventory and i not in unaware_of]
    lines += [f"The mortal holds the {SEAL_NAMES[s]}." for s in SEAL_NAMES if s in progress.seals]
    lines += [f"Known: {FLAG_DESCRIPTIONS[f]}." for f in FLAG_DESCRIPTIONS if f in progress.flags and f not in unaware_of]
    return lines
