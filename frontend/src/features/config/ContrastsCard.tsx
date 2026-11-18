import React from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { ContrastItem } from "../../types/api";

export interface KeyedContrastItem extends ContrastItem {
  _rowKey: string;
}

export interface ContrastsCardProps {
  contrasts: KeyedContrastItem[];
  diffPeaksEnabled: boolean;
  conditionOptions: string[];
  targetOptions: string[];
  onAddContrast: () => void;
  onUpdateContrast: (idx: number, field: keyof ContrastItem, value: string) => void;
  onRemoveContrast: (idx: number) => void;
}

export const ContrastsCard: React.FC<ContrastsCardProps> = ({
  contrasts,
  diffPeaksEnabled,
  conditionOptions,
  targetOptions,
  onAddContrast,
  onUpdateContrast,
  onRemoveContrast,
}) => {
  return (
    <Card>
      <CardHeader
        title={
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Typography variant="h6">
              3. Differential Peak Contrasts (params.diff_contrasts)
            </Typography>
            <Chip
              label={`${contrasts.length} contrast${contrasts.length === 1 ? "" : "s"}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Stack>
        }
        subheader="Define treatment vs. background comparisons for HOMER getDifferentialPeaksReplicates"
        action={
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={onAddContrast}
          >
            Add Contrast
          </Button>
        }
      />
      <Divider />
      <CardContent>
        <Stack spacing={2}>
          {!diffPeaksEnabled && (
            <Alert severity="info">
              <strong>HOMER Differential Peaks (Step c)</strong> is currently disabled in Step
              Toggles above. Contrasts below will be saved to <code>experiment.config</code> but
              skipped during execution until Step c is enabled.
            </Alert>
          )}

          {contrasts.length === 0 ? (
            <Alert severity="info">
              No differential contrasts configured. Click &ldquo;Add Contrast&rdquo; to add a
              treatment vs. background comparison.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Contrast ID</TableCell>
                    <TableCell>Treatment Condition</TableCell>
                    <TableCell>Background Condition</TableCell>
                    <TableCell>Target Antibody/Mark</TableCell>
                    <TableCell align="right" width={72}>
                      Remove
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contrasts.map((c, idx) => (
                    <TableRow key={c._rowKey} hover>
                      <TableCell sx={{ minWidth: 200 }}>
                        <TextField
                          fullWidth
                          value={c.id}
                          onChange={(e) => onUpdateContrast(idx, "id", e.target.value)}
                          placeholder="EV_INT_vs_N2_H3K4me3"
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        <Autocomplete
                          freeSolo
                          options={conditionOptions}
                          value={c.treatment}
                          onInputChange={(_, newValue) =>
                            onUpdateContrast(idx, "treatment", newValue)
                          }
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="EV_INT_H3K4me3"
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        <Autocomplete
                          freeSolo
                          options={conditionOptions}
                          value={c.background}
                          onInputChange={(_, newValue) =>
                            onUpdateContrast(idx, "background", newValue)
                          }
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="N2_H3K4me3"
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>
                        <Autocomplete
                          freeSolo
                          options={targetOptions}
                          value={c.target}
                          onInputChange={(_, newValue) =>
                            onUpdateContrast(idx, "target", newValue)
                          }
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="H3K4me3"
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Remove contrast">
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Remove contrast ${c.id || idx + 1}`}
                            onClick={() => onRemoveContrast(idx)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
