# 🚀 Quick Setup Command

## After Cloning the Repository

Simply type this in Cursor terminal:

```bash
npm run setup
```

**That's it!** This will automatically:
- ✅ Install all dependencies
- ✅ Create configuration files
- ✅ Set up the database
- ✅ Guide you through the rest

## Alternative Commands

You can also use any of these:

```bash
npm run init
```

```bash
bash setup.sh
```

## What Happens Next?

After running the setup:
1. Edit `server/.env` with your database credentials
2. Start the servers:
   ```bash
   # Terminal 1
   npm run server
   
   # Terminal 2  
   npm run client
   ```

## Quick Reference

- **Setup**: `npm run setup`
- **Start Backend**: `npm run server` or `cd server && npm start`
- **Start Frontend**: `npm run client` or `cd client && npm run dev`
- **Start Both**: `npm run dev`

