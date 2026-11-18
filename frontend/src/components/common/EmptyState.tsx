import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  sx?: SxProps<Theme>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  sx,
}) => {
  return (
    <Stack
      spacing={1.5}
      alignItems="center"
      justifyContent="center"
      sx={[
        { py: 6, px: 3, textAlign: "center" },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {icon && <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>}
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ pt: 0.5 }}>{action}</Box>}
    </Stack>
  );
};
