# Versus.cam 🎮

**Professional Esports Stream Management Platform**

Versus.cam is a powerful stream management tool designed specifically for esports tournament organizers, casters, and production teams. Built on top of VDO.Ninja's robust infrastructure, it provides a streamlined interface for managing multiple player streams during competitive gaming events.

## 🏆 Why Versus.cam for Esports?

### Perfect for Tournament Production
- **Multi-Stream Dashboard**: Monitor all player POVs, caster feeds, and observer cams in one place
- **Real-time Stats**: Track bitrate, resolution, and connection quality for each stream
- **Quick Stream Switching**: Instantly access any player's view link for OBS integration
- **Zero Delay**: Direct peer-to-peer connections ensure minimal latency for live commentary

### Built for Scale
- Handle 10+ simultaneous player streams without breaking a sweat
- Automatic quality adjustments based on network conditions
- No server infrastructure needed - scales with your tournament size

## 🚀 Quick Start

1. **Visit** [versus.cam](https://versus.cam)
2. **Create a room** with a unique tournament name
3. **Share invite links** with players, casters, and observers
4. **Add streams to OBS** using the individual view links

## 💡 Common Esports Setups

### Tournament Setup (10-Player Match)
Perfect for games like CS:GO, Valorant, or League of Legends:
- Create room: `MyTournament-Match1`
- Send invite links to all 10 players
- Each player shares their screen through the invite link
- Production team gets individual browser source links for each player
- Switch between POVs seamlessly in OBS

### Casting Desk Setup
For remote casting setups:
- Casters join with webcams
- Observers share game footage
- Production monitors all feeds with low-bitrate previews
- Full quality feeds go directly to OBS

## 🛠️ Technical Features

- **Optimized URLs**: Pre-configured with esports-friendly settings
  - `&proaudio` for high-quality game audio
  - `&quality` and `&maxbandwidth` for optimal stream quality
  - `&remote` for production control capabilities
  - `&vbr` for variable bitrate optimization
- **Low-latency monitoring**: 300kbps preview streams to reduce director's PC load
- **Codec flexibility**: Supports AV1 for maximum quality at lower bitrates
- **Automatic reconnection**: Players can drop and reconnect without losing their slot

## 📊 Production Controls

- **Remote bitrate control**: Adjust player stream quality on-the-fly
- **Resolution management**: Change stream resolution without player intervention
- **Network adaptation**: Automatic quality scaling based on available bandwidth

## 🎯 Use Cases

- **Online Tournaments**: Manage remote player streams for online competitions
- **LAN Events**: Backup stream management for hybrid events
- **Bootcamps**: Monitor practice sessions with multiple player POVs
- **Content Creation**: Coordinate multi-POV content with your team
- **Showmatches**: Professional production quality for exhibition matches

## 🔧 OBS Integration

1. Copy the "View Link" for any player stream
2. Add as Browser Source in OBS (recommended: 1920x1080)
3. Set custom CSS if needed for cropping/styling
4. Use Studio Mode to preview before switching

## 🌐 Browser Requirements

- **Recommended**: Chrome/Edge 100+ (Chromium-based)
- **Supported**: Any modern browser with WebRTC support
- **Best Performance**: Hardware acceleration enabled

## 💖 Built with VDO.Ninja

Versus.cam leverages the powerful [VDO.Ninja](https://vdo.ninja) IFrame API to provide enterprise-grade streaming capabilities without the enterprise price tag. Free to use, no accounts required, no streaming limits.

## 📝 License

MIT License - Use it for your tournaments, modify it for your needs, make esports production better for everyone.

---

**Ready to level up your tournament production?** 

👉 Start now at [versus.cam](https://versus.cam)

Made with 💖 for the esports community