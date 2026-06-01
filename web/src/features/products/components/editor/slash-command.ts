// ============================================================================
// slash-command.ts — TipTap extension: `/` opens slash menu (ReactRenderer)
// ============================================================================

import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import {
  filterSlashItems,
  getSlashCommandItems,
  type SlashCommandContext,
  type SlashCommandItem,
} from "./slash-command-items";
import { SlashCommandMenu, type SlashCommandMenuHandle } from "./slash-command-menu";

interface SlashCommandOptions {
  context: SlashCommandContext;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",
  addOptions() {
    return {
      context: { uploadHandlers: { image: () => {}, video: () => {}, file: () => {} } },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) =>
          filterSlashItems(getSlashCommandItems(this.options.context), query).slice(0, 20),
        command: ({ editor, range, props }) => (props as SlashCommandItem).action(editor, range),
        render: () => {
          let component: ReactRenderer<SlashCommandMenuHandle, React.ComponentProps<typeof SlashCommandMenu>> | null = null;
          return {
            onStart: (props: SuggestionProps<SlashCommandItem>) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props: {
                  items: props.items,
                  command: (item: SlashCommandItem) => props.command(item),
                  clientRect: props.clientRect ?? null,
                },
                editor: props.editor,
              });
            },
            onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
              component?.updateProps({
                items: props.items,
                command: (item: SlashCommandItem) => props.command(item),
                clientRect: props.clientRect ?? null,
              });
            },
            onKeyDown: (props): boolean => {
              if (props.event.key === "Escape") {
                component?.destroy();
                component = null;
                return true;
              }
              return component?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
