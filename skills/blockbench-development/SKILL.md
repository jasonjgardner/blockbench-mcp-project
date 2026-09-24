---
name: blockbench-plugins
description: "Blockbench plugin/extension development for the 3D modeling tool. Use when creating, modifying, or debugging JavaScript plugins for Blockbench including actions, dialogs, panels, menus, toolbars, model manipulation, animation APIs, and custom formats/codecs. Triggers on Blockbench plugin, Blockbench extension, Blockbench API, BBPlugin, model editor plugin, or 3D modeling tool extension."
---

# Blockbench Plugin Development

## Overview

Blockbench runs on desktop and the web, exposing host APIs and bundled rendering/UI libraries to plugins. Verify the target host version and its types before choosing APIs; plugin variable isolation does not imply unrestricted native-module or filesystem access. Prefer the current [generated API reference](https://web.blockbench.net/docs/) and the target checkout when older wiki examples disagree with the host. Set `variant` and `min_version` to the environments actually verified.

For model format decisions, UV units, rig distinctions and export handoffs, see [format and delivery guidance](../blockbench-use/references/formats-and-delivery.md). A format feature flag advertises host behavior; it does not implement missing validation or runtime serialization in a custom codec.

## Quick Reference

| Task | Approach |
|------|----------|
| Create clickable command | `new Action()` - add to menus/toolbars |
| Show form/dialog | `new Dialog()` with form fields |
| Add sidebar panel | `new Panel()` with Vue component |
| Modify model elements | Use `Undo.initEdit()` → modify → `Undo.finishEdit()` |
| Custom import/export | `new Codec()` + `new ModelFormat()` |
| React to changes | `Blockbench.on('event_name', callback)` |

## Plugin File Structure

```
plugins/
└── my_plugin/
    ├── my_plugin.js      # Main file (required, ID must match filename)
    ├── about.md          # Extended docs (optional)
    └── icon.png          # 48x48 icon (optional)
```

## Plugin Registration Template

```javascript
(function() {
    // Store references for cleanup
    let myAction, myPanel, myDialog, eventCallback;
    
    Plugin.register('my_plugin', {
        title: 'My Plugin',
        author: 'Author Name',
        description: 'Short description',
        icon: 'extension',            // Material icon name
        version: '1.0.0',
        variant: 'both',              // 'desktop', 'web', or 'both'
        min_version: '4.8.0',
        tags: ['Utility'],
        
        onload() {
            // Initialize all components here
        },
        
        onunload() {
            // CRITICAL: Delete ALL components here
        },
        
        oninstall() {
            Blockbench.showQuickMessage('Installed!');
        }
    });
})();
```

## Actions

Actions are clickable commands for menus, toolbars, and keybindings.

```javascript
myAction = new Action('my_action_id', {
    name: 'Action Name',
    description: 'Tooltip text',
    icon: 'star',
    category: 'edit',                 // For keybind settings
    
    condition: () => Cube.selected.length > 0,
    
    keybind: new Keybind({ key: 'k', ctrl: true }),
    
    click(event) {
        // Action logic
    }
});

MenuBar.addAction(myAction, 'filter');  // Add to Filter menu

// Cleanup
myAction.delete();
```

**Menu locations:** `'file'`, `'edit'`, `'transform'`, `'filter'`, `'tools'`, `'view'`, `'help'`

**Action variants:**
```javascript
// Toggle (on/off state)
new Toggle('toggle_id', {
    name: 'Feature',
    default: false,
    onChange(value) { /* handle */ }
});

// Tool (viewport interaction)
new Tool('tool_id', {
    name: 'My Tool',
    cursor: 'crosshair',
    onCanvasClick(data) { /* handle */ },
    onCanvasDrag(data) { /* handle */ }
});
```

## Dialogs

```javascript
myDialog = new Dialog({
    id: 'my_dialog',
    title: 'Dialog Title',
    width: 540,
    
    form: {
        name: { label: 'Name', type: 'text', value: 'default' },
        count: { label: 'Count', type: 'number', value: 10, min: 1, max: 100 },
        enabled: { label: 'Enabled', type: 'checkbox', value: true },
        mode: {
            label: 'Mode',
            type: 'select',
            options: { a: 'Option A', b: 'Option B' },
            value: 'a'
        },
        color: { label: 'Color', type: 'color', value: '#ff0000' },
        // Conditional field
        advanced: {
            label: 'Advanced',
            type: 'text',
            condition: (form) => form.enabled
        }
    },
    
    onConfirm(formData) {
        console.log(formData.name, formData.count);
        this.hide();
    }
});

myDialog.show();

// Quick dialogs
Blockbench.textPrompt('Enter Value', 'default', (text) => { });
Blockbench.showMessageBox({ title: 'Alert', message: 'Text', buttons: ['OK'] });
```

## Panels

Panels appear in sidebars with Vue components.

```javascript
myPanel = new Panel('my_panel', {
    name: 'My Panel',
    icon: 'dashboard',
    condition: () => Format.animation_mode,
    
    default_position: {
        slot: 'left_bar',             // 'left_bar', 'right_bar', 'bottom'
        height: 300
    },
    
    component: {
        template: `
            <div>
                <h3>{{ title }}</h3>
                <ul><li v-for="item in items">{{ item.name }}</li></ul>
                <button @click="refresh">Refresh</button>
            </div>
        `,
        data() {
            return { title: 'Items', items: [] };
        },
        methods: {
            refresh() {
                this.items = Cube.selected.map(c => ({ name: c.name }));
            }
        }
    }
});

// Cleanup
myPanel.delete();
```

## Model Manipulation (with Undo)

Register persistent project edits with native Undo, including every affected aspect. Validate targets and stage asynchronous input before opening a transaction; cancel/restore it on failure. Native actions or painting APIs may own their own transaction, so do not add a competing nested one. Read-only inspection, camera movement and file writes are not equivalent to undoable model mutations. See [Undo documentation](https://blockbench.net/wiki/docs/undo/).

```javascript
// Start tracking
Undo.initEdit({ elements: Cube.selected });

// Modify elements
Cube.selected.forEach(cube => {
    cube.from[0] += 5;
    cube.to[1] = 20;
    cube.rotation[1] = 45;
});

// Update view
Canvas.updateView({
    elements: Cube.selected,
    element_aspects: { geometry: true, transform: true }
});

// Commit
Undo.finishEdit('Move cubes');
```

### Creating Elements

Creation must record the new objects at transaction completion, not only an empty initial list:

```javascript
Undo.initEdit({ elements: [], outliner: true });
const createdCube = new Cube({ name: 'body_geo', from: [-4, 0, -2], to: [4, 12, 2] }).init();
Undo.finishEdit('Add body cube', { elements: [createdCube], outliner: true });
Canvas.updateAll();
```

The snippets below illustrate individual host constructors; place them inside the appropriate transaction when changing an existing project. A group's origin is a pivot; parenting does not add that origin as a translation to cube bounds.

```javascript
// Cube
let cube = new Cube({
    name: 'my_cube',
    from: [0, 0, 0],
    to: [16, 16, 16],
    origin: [8, 8, 8],
    rotation: [0, 45, 0]
}).init();
cube.addTo(Group.selected[0]);  // Add to group

// Group (bone)
let group = new Group({
    name: 'bone_arm',
    origin: [0, 12, 0]
}).init();
group.addTo();  // Add to root

// Texture
let texture = new Texture({ name: 'my_texture' });
texture.fromPath('/path/to/file.png');  // or .fromDataURL()
texture.add(true);  // true = add to undo
```

### Global Collections

| Collection | Description |
|------------|-------------|
| `Cube.all` / `Cube.selected` | All cubes / selected cubes |
| `Group.all` / `Group.selected` | All groups / selected groups |
| `Mesh.all` / `Mesh.selected` | All meshes / selected meshes |
| `Texture.all` / `Texture.selected` | All textures / selected |
| `Animation.all` / `Animation.selected` | All animations / selected |
| `Outliner.elements` | All outliner elements |

## Event System

```javascript
// Subscribe
eventCallback = (data) => { /* handle */ };
Blockbench.on('update_selection', eventCallback);

// Unsubscribe (use SAME function reference)
Blockbench.removeListener('update_selection', eventCallback);
```

**Common events:** `update_selection`, `select_project`, `new_project`, `load_project`, `save_project`, `close_project`, `add_cube`, `add_group`, `add_texture`, `add_animation`, `select_animation`, `render_frame`, `undo`, `redo`, `finish_edit`

See `references/events.md` for full list.

## Custom Menus

```javascript
let menu = new Menu([
    'existing_action_id',
    myAction,
    '_',  // Separator
    {
        name: 'Custom Item',
        icon: 'star',
        click() { /* handle */ }
    },
    {
        name: 'Submenu',
        children: [ /* more items */ ]
    }
]);

menu.open(event);  // Open at mouse position
```

## Format and Codec (Import/Export)

```javascript
const myCodec = new Codec('my_codec', {
    name: 'My Format',
    extension: 'mymodel',
    
    compile(options) {
        // Model → file content
        let data = { bones: [] };
        Group.all.forEach(g => {
            data.bones.push({
                name: g.name,
                pivot: g.origin,
                cubes: g.children.filter(c => c instanceof Cube).map(c => ({
                    from: c.from, to: c.to
                }))
            });
        });
        return JSON.stringify(data, null, 2);
    },
    
    parse(content, path) {
        // File content → model
        let data = JSON.parse(content);
        newProject(myFormat);
        data.bones.forEach(b => {
            let group = new Group({ name: b.name, origin: b.pivot }).init();
            b.cubes.forEach(c => {
                new Cube({ from: c.from, to: c.to }).init().addTo(group);
            });
        });
        Canvas.updateAll();
    }
});

const myFormat = new ModelFormat('my_format', {
    id: 'my_format',
    name: 'My Format',
    icon: 'icon_name',
    codec: myCodec,
    box_uv: true,
    bone_rig: true,
    animation_mode: true
});

// Cleanup
myFormat.delete();
myCodec.delete();
```

## Condition Patterns

```javascript
// Function
condition: () => Format.id === 'bedrock' && Cube.selected.length > 0

// Object (combined with AND)
condition: {
    formats: ['bedrock', 'java_block'],
    modes: ['edit', 'paint'],
    project: true,
    selected: { cube: 1 },
    method: () => customCheck()
}
```

## Code Style Conventions

| Type | Convention | Examples |
|------|------------|----------|
| Classes | PascalCase | `OutlinerElement`, `Animation` |
| Methods | camelCase | `updateTransform`, `getSelectedFaces` |
| Properties | snake_case | `data_points`, `uv_offset` |
| Event/Action IDs | snake_case | `select_project`, `my_action` |

## Critical Cleanup Pattern

**MUST delete all components in `onunload()` to prevent memory leaks.**

```javascript
let action, panel, dialog, toolbar, format, codec, eventCallback, css;

Plugin.register('my_plugin', {
    onload() {
        action = new Action('id', { /* ... */ });
        panel = new Panel('id', { /* ... */ });
        format = new ModelFormat('id', { /* ... */ });
        codec = new Codec('id', { /* ... */ });
        
        eventCallback = (data) => { };
        Blockbench.on('update_selection', eventCallback);
        
        css = Blockbench.addCSS('.my-class { color: blue; }');
    },
    
    onunload() {
        action.delete();
        panel.delete();
        format.delete();
        codec.delete();
        Blockbench.removeListener('update_selection', eventCallback);
        css.delete();
    }
});
```

## Anti-Patterns

```javascript
// ❌ No stored reference = memory leak
onload() { new Action('leaked', { }); }

// ❌ No Undo = users can't reverse
Cube.selected.forEach(c => c.from[0] += 1);

// ❌ Bundling THREE.js (already global)
import * as THREE from 'three';

// ❌ Global pollution
window.myData = {};
```

## Built-in Libraries (Do Not Bundle)

- **THREE** — Three.js 3D rendering
- **Vue** — host-provided reactive UI; match the host's supported component API
- **JSZip** — ZIP handling
- **marked** — Markdown parsing
- **Molang** — Molang expression parser

## Icons

```javascript
icon: 'star'              // Material icon
icon: 'fa-bone'           // Font Awesome
icon: 'icon-player'       // Blockbench custom
icon: 'data:image/...'    // Base64 image
```

## TypeScript Setup

```bash
npm i --save-dev blockbench-types
```

```typescript
/// <reference types="blockbench-types" />
```

## Template Files

- `assets/plugin_template.js` — Complete starter plugin
- `assets/format_plugin.js` — Custom format/codec example

## References

- [references/events.md](references/events.md) — Event reference; confirm version-specific events in the target host
- [references/api.md](references/api.md) — Local API examples
- [references/elements.md](references/elements.md) — Element types and properties
- [Creating a Plugin](https://blockbench.net/wiki/docs/plugin/) — Official registration, lifecycle and development guidance
- [Generated API reference](https://web.blockbench.net/docs/) — Current host types and comments

Verify a plugin edit with a representative project: expected data/preview, Undo then Redo, and unload/reload cleanup. For formats/codecs, check a representative export and reimport, including UV dimensions, hierarchy, names, texture references and animation behavior where supported. Passing compilation does not exercise native editor state or serialized output.
