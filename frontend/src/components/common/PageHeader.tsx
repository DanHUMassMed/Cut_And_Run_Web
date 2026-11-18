import React from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

export interface PageHeaderProps {
  title: string;
  badges?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  sx?: SxProps<Theme>;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  badges,
  subtitle,
  actions,
  sx,
}) => {
  return (
    <Paper
      variant="outlined"
      sx={[
        { p: 2, bgcolor: "background.paper" },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Typography variant="h6">{title}</Typography>
            {badges}
          </Stack>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            {actions}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};
