const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  nativeImage,
  globalShortcut,
  dialog
} = require('electron');

const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const crypto = require('crypto');

let win;

function dataDir() {
  return path.join(
    app.getPath('userData'),
    'paper-pocket'
  );
}

function itemsFile() {
  return path.join(
    dataDir(),
    'items.json'
  );
}

function filesDir() {
  return path.join(
    dataDir(),
    'files'
  );
}
function characterDir() {
  return path.join(
    dataDir(),
    'character'
  );
}

function characterSettingsFile() {
  return path.join(
    characterDir(),
    'settings.json'
  );
}

function readCharacterSettings() {
  try {
    return JSON.parse(
      fs.readFileSync(
        characterSettingsFile(),
        'utf8'
      )
    );
  } catch {
    return {
      enabled: false,
      src: null,
      scale: 1,
      x: 0,
      y: 0,
      opacity: 1,
      flip: false
    };
  }
}

function writeCharacterSettings(settings) {
  fs.mkdirSync(
    characterDir(),
    { recursive: true }
  );

  fs.writeFileSync(
    characterSettingsFile(),
    JSON.stringify(
      settings,
      null,
      2
    )
  );
}
function readItems() {
  try {
    return JSON.parse(
      fs.readFileSync(
        itemsFile(),
        'utf8'
      )
    );
  } catch {
    return [];
  }
}

function writeItems(items) {
  fs.mkdirSync(
    dataDir(),
    { recursive: true }
  );

  fs.writeFileSync(
    itemsFile(),
    JSON.stringify(items, null, 2)
  );
}

function makeIcon() {
  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
    >
      <rect
        rx="10"
        width="48"
        height="48"
        fill="#f4df9b"
      />

      <path
        d="M12 10h24v28H12z"
        fill="#fffaf0"
        stroke="#2b2521"
        stroke-width="2"
      />

      <path
        d="M17 18h14M17 24h14M17 30h9"
        stroke="#2b2521"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  `;

  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer
      .from(svg)
      .toString('base64')}`
  );
}

/* -----------------------------------------
   WINDOW
----------------------------------------- */

function createWindow() {
  const { workArea } =
    screen.getPrimaryDisplay();

  win = new BrowserWindow({

    width: 300,
    height: 260,

    x:
      workArea.x +
      workArea.width -
      320,

    y:
      workArea.y +
      workArea.height -
      370,

    frame: false,

    transparent: true,

    alwaysOnTop: true,

    resizable: true,

    skipTaskbar: true,

    show: false,

    webPreferences: {

      contextIsolation: true,

      nodeIntegration: false,

      sandbox: true,

      preload:
        path.join(
          __dirname,
          'preload.js'
        )
    }
  });

  win.setAlwaysOnTop(
  true,
  );
  // Keep Paper Pocket visible on the desktop,
  // but exclude it from screenshots and screen capture.
  win.setContentProtection(false);

  win.loadFile(
    path.join(
      __dirname,
      'dist',
      'index.html'
    )
  );

 win.once('ready-to-show', () => win.show());

  // Windows Snipping Tool can temporarily hide protected windows.
  // Automatically bring Paper Pocket back without stealing focus.
win.on('hide', () => {
  setTimeout(() => {
    if (win && !win.isDestroyed()) {
      win.showInactive();
    }
  }, 300);
});
}

/* -----------------------------------------
   APP START
----------------------------------------- */

app.whenReady().then(() => {

  fs.mkdirSync(
    filesDir(),
    { recursive: true }
  );
  fs.mkdirSync(
  characterDir(),
  { recursive: true }
);

  createWindow();

  globalShortcut.register(
    'CommandOrControl+Alt+P',
    () => {

      if (!win) return;

      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
      }

    }
  );
});

app.on(
  'will-quit',
  () => {
    globalShortcut.unregisterAll();
  }
);

app.on(
  'window-all-closed',
  () => {}
);

/* -----------------------------------------
   ITEMS
----------------------------------------- */

ipcMain.handle(
  'items:list',
  () => readItems()
);

const MAX_ITEM_SIZE =
  500 * 1024 * 1024;

ipcMain.handle(
  'items:import',
  async (_event, sourcePaths) => {

    const items = readItems();

    for (
      const sourcePath of sourcePaths
    ) {

      if (
        !sourcePath ||
        !fs.existsSync(sourcePath)
      ) {
        continue;
      }

      const stat =
        fs.statSync(sourcePath);

      if (!stat.isFile()) {
        continue;
      }

      if (
        stat.size >
        MAX_ITEM_SIZE
      ) {
        continue;
      }

      const id =
        crypto.randomUUID();

      const safeBase =
        path
          .basename(sourcePath)
          .replace(
            /[<>:"/\\|?*]+/g,
            '_'
          );

      const storedPath =
        path.join(
          filesDir(),
          `${id}__${safeBase}`
        );

      fs.copyFileSync(
        sourcePath,
        storedPath
      );

      const item = {

        id,

        name:
          path.basename(
            sourcePath
          ),

        type:
          path.extname(
            sourcePath
          ).toLowerCase() ||
          'file',

        size:
          stat.size,

        addedAt:
          new Date().toISOString(),

        storedPath
      };

      items.unshift(item);
    }

    writeItems(items);

    return items;
  }
);

ipcMain.handle(
  'items:remove',
  (_event, id) => {

    const items =
      readItems();

    const item =
      items.find(
        x => x.id === id
      );

    if (
      item?.storedPath &&
      fs.existsSync(
        item.storedPath
      )
    ) {

      try {
        fs.unlinkSync(
          item.storedPath
        );
      } catch {}
    }

    const next =
      items.filter(
        x => x.id !== id
      );

    writeItems(next);

    return next;
  }
);

/* -----------------------------------------
   TEXT SNIPPETS
----------------------------------------- */

ipcMain.handle(
  'items:addText',
  (_event, text) => {

    const clean =
      (text || '').trim();

    if (!clean) {
      return readItems();
    }

    const items =
      readItems();

    const id =
      crypto.randomUUID();

    const firstLine =
      clean
        .split('\n')[0]
        .slice(0, 40) ||
      'Snippet';

    const storedPath =
      path.join(
        filesDir(),
        `${id}__snippet.txt`
      );

    fs.writeFileSync(
      storedPath,
      clean,
      'utf8'
    );

    const item = {

      id,

      name:
        firstLine,

      type:
        'text',

      content:
        clean,

      size:
        Buffer.byteLength(
          clean,
          'utf8'
        ),

      addedAt:
        new Date().toISOString(),

      storedPath
    };

    items.unshift(item);

    writeItems(items);

    return items;
  }
);

/* -----------------------------------------
   HIDE
----------------------------------------- */

ipcMain.on(
  'window:hide',
  () => {
    win?.hide();
  }
);

/* -----------------------------------------
   GET WINDOW BOUNDS
----------------------------------------- */

ipcMain.handle(
  'window:getBounds',
  () => {
    return win?.getBounds();
  }
);

/* -----------------------------------------
   SET WINDOW BOUNDS / RESIZE
----------------------------------------- */

ipcMain.on(
  'window:setBounds',
  (_event, bounds) => {

    if (!win) return;

    const width =
      Math.round(
        Math.max(
          260,
          bounds.width
        )
      );

    const height =
      Math.round(
        Math.max(
          220,
          bounds.height
        )
      );

    win.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width,
      height
    });
  }
);

/* -----------------------------------------
   MOVE WINDOW
----------------------------------------- */

ipcMain.on(
  'window:moveBy',
  (_event, { dx, dy }) => {

    if (!win) return;

    const bounds =
      win.getBounds();

    win.setPosition(
      Math.round(
        bounds.x + dx
      ),
      Math.round(
        bounds.y + dy
      )
    );
  }
);

/* -----------------------------------------
   NATIVE DRAG OUT
----------------------------------------- */

ipcMain.on(
  'drag:file',
  (event, filePath) => {

    if (
      !filePath ||
      !fs.existsSync(filePath)
    ) {
      return;
    }

    if (
      !fs.statSync(
        filePath
      ).isFile()
    ) {
      return;
    }

    const icon =
      makeIcon();

    event.sender.startDrag({
      file: filePath,
      icon
    });
  }
);
/* -----------------------------------------
   CHARACTER STUDIO
----------------------------------------- */

ipcMain.handle(
  'character:get',
  () => {
    const settings =
      readCharacterSettings();

    if (
      settings.src &&
      fs.existsSync(settings.src)
    ) {
      settings.src =
        pathToFileURL(
          settings.src
        ).href;
    } else {
      settings.src = null;
      settings.enabled = false;
    }

    return settings;
  }
);

ipcMain.handle(
  'character:pick',
  async () => {

    const result =
      await dialog.showOpenDialog({
        properties: ['openFile'],

        filters: [
          {
            name: 'Character Image',
            extensions: [
              'png',
              'webp',
              'jpg',
              'jpeg'
            ]
          }
        ]
      });

    if (
      result.canceled ||
      !result.filePaths.length
    ) {
      return null;
    }

    const source =
      result.filePaths[0];

    const ext =
      path.extname(source)
        .toLowerCase();

    const destination =
      path.join(
        characterDir(),
        `character${ext}`
      );

    // Remove previous character files
    try {
      const oldFiles =
        fs.readdirSync(
          characterDir()
        );

      for (
        const file of oldFiles
      ) {
        if (
          file.startsWith(
            'character.'
          )
        ) {
          try {
            fs.unlinkSync(
              path.join(
                characterDir(),
                file
              )
            );
          } catch {}
        }
      }
    } catch {}

    fs.copyFileSync(
      source,
      destination
    );

    const current =
      readCharacterSettings();

    const settings = {
      ...current,
      enabled: true,
      src: destination
    };

    writeCharacterSettings(
      settings
    );

    return {
      ...settings,
      src:
        pathToFileURL(
          destination
        ).href
    };
  }
);

ipcMain.handle(
  'character:saveSettings',
  (_event, settings) => {

    const current =
      readCharacterSettings();

    const next = {
      ...current,
      ...settings
    };

    // Store real filesystem path,
    // not the renderer's file:// URL.
    if (
      typeof next.src === 'string' &&
      next.src.startsWith('file://')
    ) {
      next.src = current.src;
    }

    writeCharacterSettings(
      next
    );

    return next;
  }
);

ipcMain.handle(
  'character:clear',
  () => {

    const settings =
      readCharacterSettings();

    if (
      settings.src &&
      fs.existsSync(settings.src)
    ) {
      try {
        fs.unlinkSync(
          settings.src
        );
      } catch {}
    }

    const next = {
      enabled: false,
      src: null,
      scale: 1,
      x: 0,
      y: 0,
      opacity: 1,
      flip: false
    };

    writeCharacterSettings(
      next
    );

    return next;
  }
);