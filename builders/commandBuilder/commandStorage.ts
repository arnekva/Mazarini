import { blackjackCommand } from './commandStorage/blackjack'
import { botSettingsCommand } from './commandStorage/botsettings'
import { calendarCommand } from './commandStorage/calendar'
import { ccgCommand } from './commandStorage/ccg'
import { countdownCommand } from './commandStorage/countdown'
import { dailyCommand } from './commandStorage/daily'
import { deathrollCommand } from './commandStorage/deathroll'
import { deckCommand } from './commandStorage/deck'
import { dropCommand } from './commandStorage/drop'
import { frameCommand } from './commandStorage/frame'
import { jailCommand } from './commandStorage/jail'
import { jailbreakCommand } from './commandStorage/jailbreak'
import { lootboxCommand } from './commandStorage/lootbox'
import { luckyWheelCommand } from './commandStorage/luckywheel'
import { ludoCommand } from './commandStorage/ludo'
import { lyricsCommand } from './commandStorage/lyrics'
import { mastermind } from './commandStorage/mastermind'
import { memeCommand } from './commandStorage/meme'
import { moreorless } from './commandStorage/moreorless'
import { musicCommand } from './commandStorage/musikk'
import { pantelotterietCommand } from './commandStorage/pantelotteriet'
import { pickpocketCommand } from './commandStorage/pickpocket'
import { pointerbrothersCommand } from './commandStorage/pointerbrothers'
import { pollCommand } from './commandStorage/poll'
import { redactedCommand } from './commandStorage/redacted'
import { refreshCommand } from './commandStorage/refresh'
import { rewardCommand } from './commandStorage/reward'
import { rocketCommand } from './commandStorage/rocket'
import { sangCommand } from './commandStorage/sang'
import { spotifyCommand } from './commandStorage/spotify'
import { statsCommand } from './commandStorage/stats'
import { stoppCommand } from './commandStorage/stopp'
import { terningCommand } from './commandStorage/terning'
import { testCommand } from './commandStorage/test'
import { tournamentCommand } from './commandStorage/tournaments'
import { userSettingsCommand } from './commandStorage/usersettings'
import { vivinoCommand } from './commandStorage/vivino'
import { whamageddonCommand } from './commandStorage/whamageddon'

/** Easy way to get commands out from storage.
 * Commands are stored so that they can easily be recreated/updated, and not have to be copied each time.
 * If you want to update a command, just update the values in storage and run createSlashCommand() again.
 */
export namespace CommandStorage {
    export const MemeCommand = memeCommand
    export const MusicCommand = musicCommand
    export const StoppCommand = stoppCommand
    export const PickpocketCommand = pickpocketCommand
    export const JailbreakCommand = jailbreakCommand
    export const JailCommand = jailCommand
    export const SangCommand = sangCommand
    export const TournamentCommand = tournamentCommand
    export const TerningCommand = terningCommand
    export const LyricsCommand = lyricsCommand
    export const WhamageddonCommand = whamageddonCommand
    export const SpotifyCommand = spotifyCommand
    export const PollCommand = pollCommand
    export const LudoCommand = ludoCommand
    export const PointerBrothersCommand = pointerbrothersCommand
    export const VivinoCommand = vivinoCommand
    export const StatsCommand = statsCommand
    export const CountdownCommand = countdownCommand
    export const RocketCommand = rocketCommand
    export const BlackjackCommand = blackjackCommand
    export const DeathrollCommand = deathrollCommand
    export const FrameCommand = frameCommand
    export const TestCommand = testCommand
    export const LootboxCommand = lootboxCommand
    export const RewardCommand = rewardCommand
    export const DailyCommand = dailyCommand
    export const userSettings = userSettingsCommand
    export const botSettings = botSettingsCommand
    export const RefreshCommand = refreshCommand
    export const CalendarCommand = calendarCommand
    export const MoreOrLess = moreorless
    export const DropCommand = dropCommand
    export const Pantelotteriet = pantelotterietCommand
    export const Mastermind = mastermind
    export const LuckyWheel = luckyWheelCommand
    export const Redacted = redactedCommand
    export const CCG = ccgCommand
    export const Deck = deckCommand
}
