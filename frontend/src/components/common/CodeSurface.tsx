import React from "react";
import { Box, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { TextFieldProps } from "@mui/material/TextField";
import { CODE_SURFACE_TOKENS, MONOSPACE_FONT_FAMILY } from "../../theme/theme";

export interface CodeViewerProps {
  children: React.ReactNode;
  height?: number | string;
  maxHeight?: number | string;
  wrap?: boolean;
  sx?: SxProps<Theme>;
}

export const CodeViewer = React.forwardRef<HTMLPreElement, CodeViewerProps>(
  ({ children, height, maxHeight, wrap = false, sx }, ref) => {
    return (
      <Box
        ref={ref}
        component="pre"
        sx={[
          {
            m: 0,
            p: 2,
            height,
            maxHeight,
            overflow: "auto",
            bgcolor: CODE_SURFACE_TOKENS.background,
            color: CODE_SURFACE_TOKENS.mutedForeground,
            fontFamily: MONOSPACE_FONT_FAMILY,
            fontSize: "0.82rem",
            lineHeight: 1.5,
            borderRadius: 1.5,
            whiteSpace: wrap ? "pre-wrap" : "pre",
            wordBreak: wrap ? "break-word" : "normal",
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      >
        {children}
      </Box>
    );
  }
);

CodeViewer.displayName = "CodeViewer";

export type CodeEditorProps = Omit<TextFieldProps, "multiline"> & {
  minRows?: number;
  maxRows?: number;
};

export const CodeEditor: React.FC<CodeEditorProps> = ({
  minRows = 10,
  maxRows = 20,
  slotProps,
  ...rest
}) => {
  return (
    <TextField
      multiline
      minRows={minRows}
      maxRows={maxRows}
      fullWidth
      slotProps={{
        ...slotProps,
        input: {
          ...(typeof slotProps?.input === "object" ? slotProps.input : {}),
          sx: {
            fontFamily: MONOSPACE_FONT_FAMILY,
            fontSize: "0.83rem",
            lineHeight: 1.5,
            bgcolor: CODE_SURFACE_TOKENS.background,
            color: CODE_SURFACE_TOKENS.foreground,
            "& textarea": {
              fontFamily: MONOSPACE_FONT_FAMILY,
            },
          },
        },
      }}
      {...rest}
    />
  );
};
