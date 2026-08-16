import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const kindIcon = (name) => {
  const ext = name.split('.').pop()?.toLowerCase();

  if (['pdf'].includes(ext)) return '📕';
  if (['doc', 'docx'].includes(ext)) return '📘';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📗';
  if (['ppt', 'pptx'].includes(ext)) return '📙';

  if (
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
  ) {
    return '🖼️';
  }

  if (
    ['txt', 'md', 'json', 'js', 'ts', 'py', 'html', 'css'].includes(ext)
  ) {
    return '📝';
  }

  return '📎';
};

const prettySize = (n) => {
  if (n < 1024) return `${n} B`;

  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(0)} KB`;
  }

  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const IDLE_MESSAGES = [
  'waiting here~ 📎',
  'drop something on me!',
  'click me to open',
  'psst, paste text too',
  "I'll hold onto it for you",
  'got a file? I got you',
  'so... anything for me?',
  'just vibing',
  '*taps foot*',
  'need me?',
  'I can hold that',
  'your little paper shelf~',
  'one more file? 👀',
  'I am still here',
  'give me something to keep'
];

const IDLE_FACES = [
  '◕‿◕',
  '◕ᴗ◕',
  '⁀ᴗ⁀',
  '˙◡˙',
  '◔◡◔',
  '≧◡≦',
  '•ᴗ•',
  '⌐■ᴗ■',
  '◕ω◕'
];

const pickRandomExcluding = (len, exclude) => {
  if (len <= 1) return 0;

  let i;

  do {
    i = Math.floor(Math.random() * len);
  } while (i === exclude);

  return i;
};

function App() {
  const [items, setItems] = useState([]);
  const [over, setOver] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const [snippet, setSnippet] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const [msgIndex, setMsgIndex] = useState(0);
  const [faceIndex, setFaceIndex] = useState(0);

  const [character, setCharacter] = useState({
    enabled: false,
    src: null,
    scale: 1,
    x: 0,
    y: 0,
    opacity: 1,
    flip: false
  });

  const [showCharacterStudio, setShowCharacterStudio] =
    useState(false);

  const [checklist, setChecklist] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(
          'paper-pocket-checklist'
        ) || 'null'
      );
    } catch {
      return null;
    }
  });

  const [showChecklist, setShowChecklist] =
    useState(false);

  const dragCounter = useRef(0);
  const resizeState = useRef(null);

  const moveState = useRef(null);
  const suppressClick = useRef(false);

  /* -----------------------------------------
     REFRESH ITEMS
  ----------------------------------------- */

  const refresh = async () => {
    try {
      const result =
        await window.pocket.list();

      setItems(result);
    } catch (error) {
      console.error(
        'Unable to load pocket items:',
        error
      );
    }
  };

  /* -----------------------------------------
     INITIAL LOAD
  ----------------------------------------- */

  useEffect(() => {
    refresh();

    window.pocket
      .getCharacter()
      .then((saved) => {
        if (saved) {
          setCharacter(saved);
        }
      })
      .catch((error) => {
        console.error(
          'Unable to load character settings:',
          error
        );
      });
  }, []);

  /* -----------------------------------------
     RANDOM PERSONALITY
  ----------------------------------------- */

  useEffect(() => {
    if (expanded) return;

    const id = setInterval(() => {
      setMsgIndex((i) =>
        pickRandomExcluding(
          IDLE_MESSAGES.length,
          i
        )
      );

      setFaceIndex((i) =>
        pickRandomExcluding(
          IDLE_FACES.length,
          i
        )
      );
    }, 7000);

    return () => clearInterval(id);
  }, [expanded]);

  /* -----------------------------------------
     FILTERED ITEMS
  ----------------------------------------- */

  const filtered = useMemo(() => {
    const q =
      query.trim().toLowerCase();

    if (!q) return items;

    return items.filter((x) =>
      x.name.toLowerCase().includes(q)
    );
  }, [items, query]);

  /* -----------------------------------------
     CHARACTER STUDIO
  ----------------------------------------- */

  const chooseCharacter = async () => {
    try {
      const result =
        await window.pocket.pickCharacter();

      if (result) {
        setCharacter(result);
      }
    } catch (error) {
      console.error(
        'Unable to choose character:',
        error
      );
    }
  };

  const updateCharacter = async (
    key,
    value
  ) => {
    const next = {
      ...character,
      [key]: value
    };

    setCharacter(next);

    try {
      await window.pocket.saveCharacterSettings(
        next
      );
    } catch (error) {
      console.error(
        'Unable to save character settings:',
        error
      );
    }
  };

  const clearCharacter = async () => {
    try {
      const next =
        await window.pocket.clearCharacter();

      setCharacter(next);
    } catch (error) {
      console.error(
        'Unable to clear character:',
        error
      );
    }
  };

  /* -----------------------------------------
     REACTION
  ----------------------------------------- */

  const react = () => {
    setDropped(true);

    setTimeout(() => {
      setDropped(false);
    }, 500);
  };

  /* -----------------------------------------
     LOCAL TASKIFY
  ----------------------------------------- */

  const cleanTaskText = (text) => {
    return text
      .replace(
        /^\s*(?:[-*•]|\d+[.)]|[a-zA-Z][.)])\s*/,
        ''
      )
      .replace(
        /^(?:todo|task|action|next step)\s*[:\-]\s*/i,
        ''
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();
  };

  const isLikelyTask = (line) => {
    const text =
      cleanTaskText(line);

    if (!text) return false;

    if (
      text.length < 4 ||
      text.length > 180
    ) {
      return false;
    }

    // Explicit bullets / numbering.
    if (
      /^\s*(?:[-*•]|\d+[.)]|[a-zA-Z][.)])\s+/.test(
        line
      )
    ) {
      return true;
    }

    // Common action verbs.
    return /^(create|build|make|finish|complete|send|review|check|test|fix|update|write|call|email|prepare|submit|download|upload|install|configure|deploy|publish|read|learn|research|buy|book|schedule|plan|organize|clean|remove|add|implement|design|analyse|analyze|verify|confirm|follow|contact|meet|discuss|share|collect|start|continue|compare|decide|choose|apply|open|close|set|change|develop|finalize|draft|edit|proofread|practice)\b/i.test(
      text
    );
  };

  const generateChecklist = (rawText) => {
    const source =
      (rawText || '').trim();

    if (!source) {
      return null;
    }

    /*
      Normalize line endings first.
    */
    const normalized =
      source.replace(
        /\r\n?/g,
        '\n'
      );

    let lines =
      normalized
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    /*
      If the user pasted everything on one line,
      also support semicolons and pipes.
    */
    if (lines.length === 1) {
      const single = lines[0];

      if (single.includes(';')) {
        lines = single
          .split(';')
          .map((x) => x.trim())
          .filter(Boolean);
      } else if (
        single.includes('|')
      ) {
        lines = single
          .split('|')
          .map((x) => x.trim())
          .filter(Boolean);
      }
    }

    /*
      Convert every separate line into one
      potential task.

      IMPORTANT:
      We do NOT require every line to start with
      an action verb. If the user explicitly gave us
      separate lines, we trust those lines.
    */
    let tasks = lines
      .map(cleanTaskText)
      .filter(Boolean)
      .filter(
        (text) =>
          text.length >= 4 &&
          text.length <= 180
      );

    /*
      Remove duplicates while keeping order.
    */
    tasks = [...new Set(tasks)];

    /*
      If there were no multiple task lines,
      attempt sentence-based parsing.
    */
    if (tasks.length === 1) {
      const sentenceCandidates =
        source
          .split(/[.!?]\s+/)
          .map((x) => x.trim())
          .filter(Boolean)
          .map(cleanTaskText)
          .filter(Boolean)
          .filter(
            (text) =>
              text.length >= 4 &&
              text.length <= 180
          );

      const uniqueSentences = [
        ...new Set(sentenceCandidates)
      ];

      if (
        uniqueSentences.length > 1
      ) {
        tasks = uniqueSentences;
      }
    }

    if (tasks.length === 0) {
      return null;
    }

    return {
      id: crypto.randomUUID(),

      title: 'New Checklist',

      createdAt:
        new Date().toISOString(),

      tasks: tasks.map(
        (text, index) => ({
          id:
            `${Date.now()}-${index}-${Math.random()
              .toString(36)
              .slice(2, 7)}`,

          text,

          status: 'todo'
        })
      )
    };
  };

  const saveChecklist = (next) => {
    setChecklist(next);

    try {
      localStorage.setItem(
        'paper-pocket-checklist',
        JSON.stringify(next)
      );
    } catch (error) {
      console.error(
        'Unable to save checklist:',
        error
      );
    }
  };

  const taskifyText = (text) => {
    const clean =
      (text || '').trim();

    if (!clean) return;

    const generated =
      generateChecklist(clean);

    if (!generated) {
      alert(
        'I could not find clear action items in that text.'
      );
      return;
    }

    saveChecklist(generated);

    setSnippet('');

    setShowChecklist(true);

    react();
  };

  const cycleTaskStatus = (
    taskId
  ) => {
    if (!checklist) return;

    const order = [
      'todo',
      'doing',
      'done'
    ];

    const nextTasks =
      checklist.tasks.map(
        (task) => {
          if (
            task.id !== taskId
          ) {
            return task;
          }

          const currentIndex =
            order.indexOf(
              task.status
            );

          return {
            ...task,

            status:
              order[
                (currentIndex + 1) %
                  order.length
              ]
          };
        }
      );

    saveChecklist({
      ...checklist,
      tasks: nextTasks
    });
  };

  const clearChecklist = () => {
    setChecklist(null);

    setShowChecklist(false);

    try {
      localStorage.removeItem(
        'paper-pocket-checklist'
      );
    } catch {}
  };

  const checklistStats = {
    total:
      checklist?.tasks?.length || 0,

    done:
      checklist?.tasks?.filter(
        (task) =>
          task.status === 'done'
      ).length || 0
  };

  const nextTask =
    checklist?.tasks?.find(
      (task) =>
        task.status !== 'done'
    );

  /* -----------------------------------------
     FILE DROP
  ----------------------------------------- */

  const importDropped = async (e) => {
    e.preventDefault();

    dragCounter.current = 0;

    setOver(false);

    const paths =
      [...e.dataTransfer.files]
        .map((f) =>
          window.pocket.pathForFile(f)
        )
        .filter(Boolean);

    if (paths.length) {
      setExpanded(true);

      try {
        setItems(
          await window.pocket.importFiles(
            paths
          )
        );

        react();
      } catch (error) {
        console.error(
          'Unable to import dropped files:',
          error
        );
      }
    }
  };

  const onDragEnter = (e) => {
    e.preventDefault();

    dragCounter.current++;

    setOver(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();

    dragCounter.current--;

    if (
      dragCounter.current <= 0
    ) {
      dragCounter.current = 0;

      setOver(false);
    }
  };

  /* -----------------------------------------
     ITEMS
  ----------------------------------------- */

  const remove = async (id) => {
    try {
      setItems(
        await window.pocket.remove(id)
      );
    } catch (error) {
      console.error(
        'Unable to remove item:',
        error
      );
    }
  };

  const addSnippet = async () => {
    const clean =
      snippet.trim();

    if (!clean) return;

    try {
      setItems(
        await window.pocket.addText(
          clean
        )
      );

      setSnippet('');

      react();
    } catch (error) {
      console.error(
        'Unable to save snippet:',
        error
      );
    }
  };

  const copyText = async (
    item
  ) => {
    try {
      await navigator.clipboard.writeText(
        item.content || ''
      );

      setCopiedId(item.id);

      setTimeout(() => {
        setCopiedId(null);
      }, 1000);
    } catch (error) {
      console.error(
        'Unable to copy text:',
        error
      );
    }
  };

  /* -----------------------------------------
     MOVE WINDOW
  ----------------------------------------- */

  const onCharacterPointerDown =
    async (e) => {
      if (e.button !== 0) return;

      e.preventDefault();

      try {
        const bounds =
          await window.pocket.getBounds();

        moveState.current = {
          startX: e.screenX,
          startY: e.screenY,
          x: bounds.x,
          y: bounds.y,
          moved: false
        };

        suppressClick.current =
          false;

        window.addEventListener(
          'pointermove',
          onCharacterPointerMove
        );

        window.addEventListener(
          'pointerup',
          onCharacterPointerUp
        );
      } catch (error) {
        console.error(
          'Unable to start window movement:',
          error
        );
      }
    };

  const onCharacterPointerMove = (
    e
  ) => {
    if (!moveState.current)
      return;

    const state =
      moveState.current;

    const dx =
      e.screenX -
      state.startX;

    const dy =
      e.screenY -
      state.startY;

    if (
      !state.moved &&
      Math.abs(dx) < 5 &&
      Math.abs(dy) < 5
    ) {
      return;
    }

    state.moved = true;

    suppressClick.current =
      true;

    window.pocket.moveBy(
      dx,
      dy
    );

    state.startX =
      e.screenX;

    state.startY =
      e.screenY;
  };

  const onCharacterPointerUp =
    () => {
      const wasMoved =
        moveState.current?.moved;

      moveState.current =
        null;

      window.removeEventListener(
        'pointermove',
        onCharacterPointerMove
      );

      window.removeEventListener(
        'pointerup',
        onCharacterPointerUp
      );

      if (wasMoved) {
        suppressClick.current =
          true;

        setTimeout(() => {
          suppressClick.current =
            false;
        }, 100);
      }
    };

  const onCharacterClick =
    () => {
      if (
        suppressClick.current
      ) {
        return;
      }

      setExpanded(
        (v) => !v
      );
    };

  /* -----------------------------------------
     RESIZE
  ----------------------------------------- */

  const onResizeMove = (
    e
  ) => {
    if (!resizeState.current)
      return;

    const s =
      resizeState.current;

    const dx =
      e.screenX -
      s.startX;

    const dy =
      e.screenY -
      s.startY;

    window.pocket.setBounds({
      x: s.x,
      y: s.y,
      width:
        s.width + dx,
      height:
        s.height + dy
    });
  };

  const onResizeEnd =
    () => {
      resizeState.current =
        null;

      window.removeEventListener(
        'mousemove',
        onResizeMove
      );

      window.removeEventListener(
        'mouseup',
        onResizeEnd
      );
    };

  const onResizeStart =
    async (e) => {
      e.preventDefault();

      e.stopPropagation();

      try {
        const bounds =
          await window.pocket.getBounds();

        resizeState.current = {
          startX: e.screenX,
          startY: e.screenY,
          ...bounds
        };

        window.addEventListener(
          'mousemove',
          onResizeMove
        );

        window.addEventListener(
          'mouseup',
          onResizeEnd
        );
      } catch (error) {
        console.error(
          'Unable to start resize:',
          error
        );
      }
    };

  /* -----------------------------------------
     RENDER
  ----------------------------------------- */

  return (
    <div
      className={`shell ${
        over ? 'over' : ''
      } ${
        expanded
          ? 'expanded'
          : 'compact'
      } ${
        dropped ? 'dropped' : ''
      } ${
        character.enabled
          ? 'hasCustomCharacter'
          : ''
      }`}

      onDragEnter={
        onDragEnter
      }

      onDragOver={(e) =>
        e.preventDefault()
      }

      onDragLeave={
        onDragLeave
      }

      onDrop={
        importDropped
      }
    >

      {/* CHARACTER */}

      <div
        className="character"

        onPointerDown={
          onCharacterPointerDown
        }

        onClick={
          onCharacterClick
        }

        title="Click to open • Drag to move"
      >
        {character.enabled &&
        character.src ? (

          <img
            className="characterImage"

            src={
              character.src
            }

            draggable="false"

            alt="Paper Pocket character"

            style={{
              transform: `
                translate(
                  ${character.x}px,
                  ${character.y}px
                )
                scale(
                  ${character.scale}
                )
                scaleX(
                  ${character.flip
                    ? -1
                    : 1}
                  )
              `,

              opacity:
                character.opacity
            }}
          />

        ) : (

          <>
            <div className="anime-head">
              {over
                ? '◕ω◕'
                : dropped
                ? '★‿★'
                : IDLE_FACES[
                    faceIndex
                  ]}
            </div>

            <div className="anime-body">
              ▰
            </div>
          </>

        )}
      </div>

      {/* IDLE SPEECH */}

      {!expanded &&
        !character.enabled && (
          <div className="bubble">
            {over
              ? 'drop it!'
              : IDLE_MESSAGES[
                  msgIndex
                ]}
          </div>
        )}

      {/* PAPER */}

      {expanded && (
        <div className="paper">

          <div className="tape" />

          {/* HEADER */}

          <div className="header">

            <div>
              <div className="title">
                Paper Pocket
              </div>

              <div className="subtitle">
                Drop it. Keep it. Drag it out.
              </div>
            </div>

            <div className="actions">

           
              <button
                className="tinyBtn"

                onClick={() =>
                  setShowCharacterStudio(
                    true
                  )
                }

                title="Character Studio"
              >
                🎨
              </button>

              <button
                className="tinyBtn"

                onClick={() =>
                  setExpanded(
                    false
                  )
                }
              >
                −
              </button>

              <button
                className="tinyBtn"

                onClick={() =>
                  window.pocket.hide()
                }
              >
                ×
              </button>

            </div>

          </div>

          {/* SEARCH */}

          <input
            className="search"

            placeholder="Search your pocket…"

            value={query}

            onChange={(e) =>
              setQuery(
                e.target.value
              )
            }
          />

          {/* SNIPPET / TASKIFY */}

          <div className="snippetRow">

            <textarea
              className="snippetInput"

              placeholder={
                'Paste a link, prompt, note…\n' +
                'For Taskify, put each task on a new line.'
              }

              value={snippet}

              onChange={(e) =>
                setSnippet(
                  e.target.value
                )
              }

              onKeyDown={(e) => {
                /*
                  Ctrl/Cmd + Enter =
                  Taskify quickly.
                */
                if (
                  e.key === 'Enter' &&
                  (e.ctrlKey ||
                    e.metaKey)
                ) {
                  e.preventDefault();

                  taskifyText(
                    snippet
                  );
                }
              }
              }
            />

            <div className="snippetActions">

              <button
                className="tinyBtn"

                onClick={
                  addSnippet
                }

                title="Save snippet"
              >
                +
              </button>

              <button
                className="taskifyBtn"

                onClick={() =>
                  taskifyText(
                    snippet
                  )
                }

                disabled={
                  !snippet.trim()
                }

                title="Turn this into a checklist"
              >
                ☑
              </button>

            </div>

          </div>

          {/* DROP ZONE */}

          <div className="dropzone">

            {filtered.length === 0 ? (

              <div className="empty">

                <div className="emptyIcon">
                  {over
                    ? '✨'
                    : '📥'}
                </div>

                <strong>
                  {over
                    ? 'Drop it here'
                    : 'Drop files here'}
                </strong>

                <span>
                  PDF, Word, images,
                  ZIP, TXT, or paste
                  a snippet above.
                </span>

              </div>

            ) : (

              filtered.map(
                (item) => (

                  <div
                    className="item"

                    key={
                      item.id
                    }

                    draggable

                    onDragStart={() =>
                      window.pocket.startDrag(
                        item.storedPath
                      )
                    }

                    title={
                      item.type === 'text'
                        ? 'Click to copy, or drag out as a .txt file'
                        : 'Drag me out to another app or folder'
                    }

                    onClick={() =>
                      item.type ===
                        'text' &&
                      copyText(item)
                    }
                  >

                    <div className="icon">
                      {item.type ===
                      'text'
                        ? '📝'
                        : kindIcon(
                            item.name
                          )}
                    </div>

                    <div className="meta">

                      <div className="name">
                        {item.type ===
                          'text' &&
                        copiedId ===
                          item.id
                          ? 'Copied!'
                          : item.name}
                      </div>

                      <div className="size">
                        {prettySize(
                          item.size
                        )}
                      </div>

                    </div>

                    <button
                      className="remove"

                      onClick={(e) => {
                        e.stopPropagation();

                        remove(
                          item.id
                        );
                      }}

                      aria-label="Remove"
                    >
                      ×
                    </button>

                  </div>

                )
              )

            )}

          </div>

          {/* RESIZE */}

          <div
            className="resizeGrip"

            onMouseDown={
              onResizeStart
            }

            title="Drag to resize"
          />

          {/* CHARACTER STUDIO */}

          {showCharacterStudio && (
            <div className="characterStudio">

              <div className="studioHeader">

                <div>

                  <div className="studioTitle">
                    Character Studio
                  </div>

                  <div className="studioSubtitle">
                    Make Paper Pocket yours.
                  </div>

                </div>

                <button
                  className="studioClose"

                  onClick={() =>
                    setShowCharacterStudio(
                      false
                    )
                  }
                >
                  ×
                </button>

              </div>

              <div className="studioPreview">

                {character.enabled &&
                character.src ? (

                  <img
                    src={
                      character.src
                    }

                    alt="Preview"

                    draggable="false"

                    style={{
                      transform: `
                        translate(
                          ${character.x / 2}px,
                          ${character.y / 2}px
                        )
                        scale(
                          ${character.scale}
                        )
                        scaleX(
                          ${character.flip
                            ? -1
                            : 1}
                        )
                      `,

                      opacity:
                        character.opacity
                    }}
                  />

                ) : (

                  <div className="previewEmpty">
                    Upload a character
                  </div>

                )}

              </div>

              <div className="studioButtons">

                <button
                  className="studioPrimary"

                  onClick={
                    chooseCharacter
                  }
                >
                  📤 Upload Character
                </button>

                {character.enabled && (
                  <button
                    className="studioSecondary"

                    onClick={
                      clearCharacter
                    }
                  >
                    Remove
                  </button>
                )}

              </div>

              <label className="control">

                <span>
                  Size

                  <b>
                    {Math.round(
                      character.scale *
                        100
                    )}
                    %
                  </b>
                </span>

                <input
                  type="range"

                  min="0.3"

                  max="2.2"

                  step="0.05"

                  value={
                    character.scale
                  }

                  onChange={(e) =>
                    updateCharacter(
                      'scale',
                      Number(
                        e.target.value
                      )
                    )
                  }
                />

              </label>

              <label className="control">

                <span>
                  Horizontal

                  <b>
                    {character.x}px
                  </b>
                </span>

                <input
                  type="range"

                  min="-80"

                  max="80"

                  value={
                    character.x
                  }

                  onChange={(e) =>
                    updateCharacter(
                      'x',
                      Number(
                        e.target.value
                      )
                    )
                  }
                />

              </label>

              <label className="control">

                <span>
                  Vertical

                  <b>
                    {character.y}px
                  </b>
                </span>

                <input
                  type="range"

                  min="-100"

                  max="100"

                  value={
                    character.y
                  }

                  onChange={(e) =>
                    updateCharacter(
                      'y',
                      Number(
                        e.target.value
                      )
                    )
                  }
                />

              </label>

              <label className="control">

                <span>
                  Opacity

                  <b>
                    {Math.round(
                      character.opacity *
                        100
                    )}
                    %
                  </b>
                </span>

                <input
                  type="range"

                  min="0.3"

                  max="1"

                  step="0.05"

                  value={
                    character.opacity
                  }

                  onChange={(e) =>
                    updateCharacter(
                      'opacity',
                      Number(
                        e.target.value
                      )
                    )
                  }
                />

              </label>

              <button
                className="flipButton"

                onClick={() =>
                  updateCharacter(
                    'flip',
                    !character.flip
                  )
                }
              >
                ↔ Flip Character
              </button>

            </div>
          )}

          {/* CHECKLIST */}

          {showChecklist && (
            <div className="checklistPanel">

              <div className="checklistHeader">

                <div>

                  <div className="checklistTitle">
                    ☑ Taskify
                  </div>

                  <div className="checklistSubtitle">
                    {checklistStats.done}{' '}
                    /{' '}
                    {checklistStats.total}{' '}
                    completed
                  </div>

                </div>

                <button
                  className="studioClose"

                  onClick={() =>
                    setShowChecklist(
                      false
                    )
                  }
                >
                  ×
                </button>

              </div>

              {checklist &&
                checklist.tasks.length >
                  0 && (
                  <>

                    <div className="progressTrack">

                      <div
                        className="progressBar"

                        style={{
                          width: `${
                            checklistStats.total
                              ? (
                                  checklistStats.done /
                                  checklistStats.total
                                ) *
                                100
                              : 0
                          }%`
                        }}
                      />

                    </div>

                    {nextTask && (
                      <div className="nextTask">

                        <span>
                          NEXT
                        </span>

                        <strong>
                          {nextTask.text}
                        </strong>

                      </div>
                    )}

                    <div className="taskList">

                      {checklist.tasks.map(
                        (task) => (

                          <button
                            key={
                              task.id
                            }

                            className={
                              `taskRow ${task.status}`
                            }

                            onClick={() =>
                              cycleTaskStatus(
                                task.id
                              )
                            }

                            title="Click to change status"
                          >

                            <span className="taskStatus">
                              {task.status ===
                              'todo'
                                ? '○'
                                : task.status ===
                                  'doing'
                                ? '◐'
                                : '✓'}
                            </span>

                            <span className="taskText">
                              {task.text}
                            </span>

                            <span className="taskState">

                              {task.status ===
                              'todo'
                                ? 'To Do'
                                : task.status ===
                                  'doing'
                                ? 'Doing'
                                : 'Done'}

                            </span>

                          </button>

                        )
                      )}

                    </div>

                    <button
                      className="clearChecklist"

                      onClick={
                        clearChecklist
                      }
                    >
                      Clear checklist
                    </button>

                  </>
                )}

            </div>
          )}

        </div>
      )}

    </div>
  );
}

createRoot(
  document.getElementById('root')
).render(<App />);