# 1e Character Sheet: setup guide

An Owlbear Rodeo extension for AD&D 1st Edition: a character sheet for players, and Encounters, Treasure and Combat tools for the GM. Rules as written (the 1e books).

## 1. Install
1. In Owlbear Rodeo open your profile menu, then **Extensions**.
2. **Add Custom Extension**, paste the manifest URL, press **Add**:

   `https://solid-state-games.github.io/1e-toolkit/manifest.json`

## 2. Add it to a room
Open the room's **Extensions** list and switch on **1e Character Sheet**. Everyone gets the toolkit icon and the right-click item **Open 1e sheet** on character tokens.

## 3. Players: link your token to a sheet
1. Put your token on the **Character** layer.
2. Right-click it, choose **Open 1e sheet** (or use the toolkit icon, Characters tab, **Create** or **Open**).
3. Fill in the sheet. It saves into the token by itself; the bar at the foot shows the 16 kB token allowance. The sheet is the link, there is nothing else to connect.
4. To start from a saved character use **Import JSON**.

Seven pages: Abilities, Combat, Skills and look, Equipment, Spells, Notes, Retainers. Scores are final scores (after race and age). Figures are worked out from the books and shown with their pages.

**Left behind, and followers.** On the Equipment page, add **Places** (a room at an inn, a stronghold vault, a bank), then move any item to a place with its "Move to" box; coins can be kept per place too. Only what you carry counts toward load, movement and armour class. The **Retainers** page lists henchmen (maximum from Charisma, loyalty from the DMG tables, a Check loyalty button, an optional linked token with its own sheet) and hirelings (soldiers and experts with the DMG monthly costs), totals the monthly cost and has a Pay a month button that takes the coins from a place you choose. All of it stays private to the sheet's owner and the GM.

## 4. GM view
The GM sees extra tabs (players never do): **Encounters**, **Treasure**, **Combat**. The **Characters** tab lists every character token: open, import, export, and **Assign** a token to a player.

## Who can edit what
- The GM edits every sheet.
- A player saves sheets on tokens they created (Owlbear lets players change only items they created, unless the room allows players to update characters).
- **Assign** marks the token as a player's and tries to hand the token over so they can save. If Owlbear refuses, the sheet opens read only: allow character updates for players in room permissions, or have the player build the sheet on their own token.
- Read only sheets can still be exported.

## 5. Moving a character between rooms
Sheets live in the token. In the old room press **Export JSON** (downloads a `.1e-sheet.json`). In the new room make a token on the Character layer, open its sheet, press **Import JSON** (the GM can use **Import** in the Characters tab). The file is also your backup.

## Troubleshooting
- **No "Open 1e sheet" in the menu:** token must be on the Character layer, one token selected, extension switched on for the room.
- **Read only banner:** you did not create the token and the GM has not handed it to you.
- **NOT SAVED, over 16 kB:** shorten notes, trim gear or spell lists (typical sheet 1 to 3 kB; the largest possible sheet with every cap reached and a non-caster is about 15.6 kB; places are capped at 10, henchmen at 15, hireling lines at 20).
- **Fonts plain:** offline falls back to system fonts. Nothing is lost.
- **Try it outside Owlbear:** open `index.html?dev=gm` or `?dev=player` in a normal browser (data stays in that browser).

## Licence and credit
MIT, copyright Solid State Games 2026. Includes the Owlbear Rodeo SDK (MIT, see vendor/README.md).

Unofficial fan work, built from the AD&D 1st Edition Dungeon Masters Guide, Players Handbook and Monster Manual. Not affiliated with or endorsed by the rights holders.
