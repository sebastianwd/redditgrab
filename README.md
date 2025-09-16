# RedditGrab

Browser extension for downloading images and videos from Reddit posts. Supports individual downloads and mass downloading with auto-scrolling.

https://github.com/user-attachments/assets/35a07fed-9448-4369-b3c5-638a47ac93fa

## Features

- Individual post downloads via injected buttons
- Mass downloads with auto-scrolling
- Customizable download settings and folder organization
- Title overlay on images and videos
- Image processing with FFmpeg

## Prerequisites

- Node.js 22+
- pnpm

## Setup

1. Clone and install dependencies:

   ```bash
   git clone <repository-url>
   cd redditgrab
   pnpm install
   ```

2. Development:
   ```bash
   pnpm dev          # Start development server
   pnpm build        # Build for production
   pnpm build:firefox # Build for Firefox
   ```

## Usage

### Individual Downloads

1. Navigate to reddit.com
2. Click the blue "Download" button on any post
3. Media downloads automatically

### Mass Downloads

1. Open the RedditGrab sidebar panel
2. Configure download settings
3. Click "Start Mass Download"

### Settings

- **Download Folder**: Where files are saved (supports `{subreddit}` variable)
- **Filename Pattern**: File naming (supports `{subreddit}`, `{timestamp}`, `{filename}`)
- **Gallery Folders**: Separate folders for image galleries
- **Title Overlay**: Add post titles to media

## Development

Built with [WXT](https://wxt.dev/) and React.

### Scripts

- `pnpm dev` - Development server
- `pnpm dev:firefox` - Firefox development
- `pnpm build` - Production build
- `pnpm build:firefox` - Firefox build
- `pnpm zip` - Create distribution zip

### Structure

```
entrypoints/
├── background.ts          # Background script
├── download-button.content/ # Content script
├── offscreen/             # Offscreen document (Chrome only)
└── sidepanel/             # Sidebar UI
components/                # React components
utils/                     # Utilities
public/                    # Static assets
```

## Permissions

- `webRequest` - Download media files
- `downloads` - Save files
- `activeTab` - Interact with Reddit
- `storage` - Save settings
- `scripting` - Inject buttons
- `tabs` - Query active tab
- `offscreen` - Required for using ffmpeg.wasm in Chrome

## Privacy

No data collection:

- No analytics
- No marketing data
- All media processing is local
