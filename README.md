
# DDR Overlays
Stream overlays for RotorHazard as a plugin. You can use these in OBS or any other streaming software with browser input. These are used and made by Dutch Drone Racing but totally free to use.

> [!IMPORTANT]
> This plugin is still a work in progress. The code should be cleaned and a few more overlays should be added. Feel free to help!

## Overlays
- Single Pilot Node
- Live Results
- Race Status Bar
- Qualifier Leaderboard
- Qualifier Leaderboard / 4 pages
- Brackets
- 'Last Heat' display
- 'Next Up' display

## Installation
Download the latest release and put the **ddr_overlays** folder in the **plugins** folder of your RotorHazard installation. (Re-)Start your RotorHazard server.

On the settings page of your RotorHazard panel the section `DDR - OBS Overlays` shows up. Press the link, it will bring you to the page with links to the overlays.

To setup country flags and pilot avatars refer to the **Important Information** below.

## Important Information

### Pilot Avatars
Pilot avatars are obtained from the `/server/static/user/avatars/`  folder. The file name should be the pilot's callsign in lowercase where spaces has been replaced for underscores (_) and in the .jpg file type. The file should be a square image, preferably 256x256 or 512x612 pixels. If no avatar is found it will show the default avatar.

### Country Flags
A country can be set as pilot attribute in the pilots tab (dropdown). When set it shows the flag icon before the pilot's callsign.

### Brackets
For now supported brackets are 32 double-elimination (FAI, 4-up, 32-pilot) and 16 double-elimination (MultiGP, 4-up, 16-pilot). Others will follow.

The advice is to load the whole page as 1 source in OBS and then make 2 scenes, one for the Winner Bracket and one for the Lower Bracket and crop the source accordingly. This way you can easily switch between the two.

## Screenshots

![Next Up](https://dutchdroneracing.com/wp-content/uploads/2024/07/nextup.jpg)

![Next Up](https://dutchdroneracing.com/wp-content/uploads/2024/07/nextup2.jpg)

![Nodes, Status Bar & Leaderboard](https://dutchdroneracing.com/wp-content/uploads/2024/07/nodes.jpg)

![Leaderboard](https://dutchdroneracing.com/wp-content/uploads/2024/07/leaderboard.jpg)

![Winner Bracket](https://dutchdroneracing.com/wp-content/uploads/2024/07/winner_bracket.jpg)

![Lower Bracket](https://dutchdroneracing.com/wp-content/uploads/2024/07/lower_bracket.jpg)

## Feedback

If you have any feedback, please create an issue on this repository.
