"use client";

import dynamic from "next/dynamic";
import {
  withFieldGroup,
  createDefaultFieldValidators,
} from "@arqiva/react-component-lib";
import { createGroupSchema } from "@/lib/services/api/dashboard/Groups/models/createGroup";
import { useCallback, useEffect } from "react";
import type { GetGroupMetersResponse } from "@/lib/services/api/dashboard/Meters/models/getGroupMeters";
import { useToastNotifications } from "@/hooks/useToastNotifications";
import { useMeterSelection } from "@/lib/services/api/dashboard/Meters/hooks/useMeterSelection";
import {
  handleMeterFileUpload,
  handleDropdownSelectionChange,
} from "@/lib/services/api/dashboard/Meters/hooks/meterFileHandler";
import { MeterSelectionSummary } from "./meterSelectionSummary";
import { ExistingMetersList } from "./existingMeterList";
import { FileParseResult } from "@/utils/common/fileParser";

const FileUpload = dynamic(
  () =>
    import("@arqiva/react-component-lib")
      .then((mod) => mod.FileUpload)
      .catch(() => () => <div>FileUpload component failed to load</div>),
  { ssr: false }
);

interface CreateGroupFields {
  name: string;
  description: string;
  created_by: string;
  meterId: string[];
  file?: File;
  customer_id?: string;
}

function RenderFieldGroup({
  group,
  isEditMode,
  groupId,
  initialGroupMetersData,
  removedMeterIds,
  onRemoveMeter,
}: {
  group: {
    form: {
      getFieldValue: (name: string) => unknown;
      setFieldValue: (name: string, value: unknown) => void;
    };
    AppField: React.ComponentType<{
      name: string;
      validators?: unknown;
      children: (field: unknown) => React.ReactNode;
    }>;
  };
  isEditMode: boolean;
  groupId?: number;
  initialGroupMetersData?: GetGroupMetersResponse;
  removedMeterIds: Set<number>;
  onRemoveMeter: (meterId: number) => void;
}) {
  const toast = useToastNotifications();
  const initialMeterIds = isEditMode
    ? (group.form.getFieldValue("meterId") as string[]) || []
    : [];

  const {
    meterOptions,
    metersLoading,
    setFileUploadedMeterIds,
    setDropdownSelectedMeterIds,
    existingMeterIds,
    displayedMeterIds,
    uniqueMergedIds,
    fileUploadedMeterIds,
    dropdownSelectedMeterIds,
    totalSelectedMeters,
  } = useMeterSelection({ isEditMode, initialMeterIds });

  useEffect(() => {
    group.form.setFieldValue("meterId", uniqueMergedIds);
  }, [uniqueMergedIds, group.form]);

  const handleFileParse = useCallback(
    (parsed: unknown) => {
      handleMeterFileUpload(parsed as FileParseResult, existingMeterIds, {
        onSuccess: (ids) => {
          setFileUploadedMeterIds(new Set(ids));
        },
        onError: (msg) => {
          toast.error(msg);
        },
        onWarning: (msg) => {
          toast.warning(msg);
        },
      });
    },
    [existingMeterIds, setFileUploadedMeterIds, toast]
  );

  const removedMeterIdStrings = new Set(
    Array.from(removedMeterIds).map(String)
  );
  const visibleExistingMeterCount = Array.from(existingMeterIds).filter(
    (id) => !removedMeterIdStrings.has(id)
  ).length;

  return (
    <>
      <group.AppField
        name="name"
        validators={createDefaultFieldValidators(createGroupSchema.shape.name)}
      >
        {(field) => {
          const typedField = field as {
            TextField: React.ComponentType<{
              label: string;
              placeholder: string;
            }>;
          };
          return <typedField.TextField label="Name" placeholder="Group Name" />;
        }}
      </group.AppField>

      <group.AppField
        name="description"
        validators={createDefaultFieldValidators(
          createGroupSchema.shape.description
        )}
      >
        {(field) => {
          const typedField = field as {
            TextareaField: React.ComponentType<{
              label: string;
              placeholder: string;
              rows: number;
            }>;
          };
          return (
            <typedField.TextareaField
              label="Description (optional)"
              placeholder="Write a short description for your group."
              rows={5}
            />
          );
        }}
      </group.AppField>

      {isEditMode && (
        <ExistingMetersList
          groupId={groupId!}
          groupName={group.form.getFieldValue("name") as string}
          groupDescription={group.form.getFieldValue("description") as string}
          initialData={initialGroupMetersData}
          removedMeterIds={removedMeterIds}
          onRemoveMeter={onRemoveMeter}
        />
      )}

      <group.AppField
        name="file"
        validators={createDefaultFieldValidators(createGroupSchema.shape.file)}
      >
        {(field) => {
          const typedField = field as {
            setValue: (value: File | undefined) => void;
          };
          return (
            <FileUpload
              placeholder={
                isEditMode
                  ? "Upload CSV / TXT to add meters"
                  : "Upload CSV / TXT (meter IDs)"
              }
              accept=".csv,.txt,.xls,.xlsx"
              parseFile
              onFileSelect={(file: File | null) =>
                typedField.setValue(file ?? undefined)
              }
              onFileRemove={() => {
                typedField.setValue(undefined);
                setFileUploadedMeterIds(new Set());
              }}
              onFileParse={handleFileParse}
            />
          );
        }}
      </group.AppField>

      <MeterSelectionSummary
        isEditMode={isEditMode}
        totalSelectedMeters={totalSelectedMeters}
        existingMeterCount={visibleExistingMeterCount}
        fileUploadedMeterCount={fileUploadedMeterIds.size}
        dropdownSelectedMeterCount={dropdownSelectedMeterIds.size}
      />

      <group.AppField
        name="meterId"
        validators={createDefaultFieldValidators(
          createGroupSchema.shape.meterId
        )}
      >
        {(field) => {
          const typedField = field as {
            SearchableSelectField: React.ComponentType<{
              label: string;
              placeholder: string;
              options: { value: string; label: string }[];
              isClearable: boolean;
              isMulti: boolean;
              isLoading: boolean;
              value: { value: string; label: string }[];
              onChange: (options: unknown) => void;
            }>;
          };

          const handleChange = (options: unknown) => {
            handleDropdownSelectionChange(options, setDropdownSelectedMeterIds);
          };

          return (
            <div style={{ marginTop: "var(--spacing-3xl)" }}>
              <typedField.SearchableSelectField
                label="Meter ID"
                placeholder={
                  metersLoading ? "Loading meters..." : "Select a meter"
                }
                options={meterOptions}
                isClearable
                isMulti
                isLoading={metersLoading}
                value={displayedMeterIds.map((id) => ({
                  value: id,
                  label: id,
                }))}
                onChange={handleChange}
              />
            </div>
          );
        }}
      </group.AppField>
    </>
  );
}

function CreateAndEditGroupFieldGroup({
  form,
  groupId,
  initialGroupMetersData,
  removedMeterIds,
  onRemoveMeter,
}: {
  form: unknown;
  groupId?: number;
  initialGroupMetersData?: GetGroupMetersResponse;
  removedMeterIds?: Set<number>;
  onRemoveMeter?: (meterId: number) => void;
}) {
  const isEditMode = !!groupId;

  const FieldGroup = withFieldGroup<CreateGroupFields, CreateGroupFields>({
    render: ({ group }) => (
      <RenderFieldGroup
        group={{
          ...group,
          AppField: group.AppField as React.ComponentType<{
            name: string;
            validators?: unknown;
            children: (field: unknown) => React.ReactNode;
          }>,
        }}
        isEditMode={isEditMode}
        groupId={groupId}
        initialGroupMetersData={initialGroupMetersData}
        removedMeterIds={removedMeterIds || new Set()}
        onRemoveMeter={
          onRemoveMeter ||
          (() => {
            // no-op: fallback if onRemoveMeter not provided
          })
        }
      />
    ),
  });

  return (
    <FieldGroup
      form={form as any} // eslint-disable-line @typescript-eslint/no-explicit-any
      fields={
        {
          name: "name",
          description: "description",
          created_by: "created_by",
          meterId: "meterId",
          file: "file",
          customer_id: "customer_id",
        } as any // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    />
  );
}

export default dynamic(
  () =>
    Promise.resolve(CreateAndEditGroupFieldGroup).catch(
      () => CreateAndEditGroupFieldGroup
    ),
  { ssr: false }
);


//fileparser.ts

export interface ParsedMeterData {
  id: number;
}

export interface FileParseResult {
  success: boolean;
  data: ParsedMeterData[];
  duplicates: number[];
  error?: string;
}

const VALID_HEADER_NAMES = ["meter_id", "meter id", "meterid", "id", "meter"];

function findMeterIdColumn(headers: string[]): string | null {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const validHeader of VALID_HEADER_NAMES) {
    const index = normalizedHeaders.indexOf(validHeader);
    if (index !== -1) {
      return headers[index];
    }
  }

  return null;
}

export function validateAndExtractMeterIds(
  headers: string[],
  data: Record<string, unknown>[],
  existingMeterIds?: number[]
): FileParseResult {
  try {
    const meterIdColumn = findMeterIdColumn(headers);

    if (!meterIdColumn) {
      return {
        success: false,
        data: [],
        duplicates: [],
        error: `Invalid file format. Header must contain one of: ${VALID_HEADER_NAMES.join(", ")}`,
      };
    }

    const meterIds: ParsedMeterData[] = [];
    const seenIds = new Set<number>();
    const duplicateIds: number[] = [];
    const existingSet = new Set(existingMeterIds || []);

    for (const row of data) {
      const rawValue = row[meterIdColumn];

      if (rawValue === null || rawValue === undefined || rawValue === "") {
        continue;
      }

      const meterId = Number(rawValue);

      if (!Number.isFinite(meterId) || meterId <= 0) {
        continue;
      }

      if (existingSet.has(meterId)) {
        if (!duplicateIds.includes(meterId)) {
          duplicateIds.push(meterId);
        }
        continue;
      }

      if (seenIds.has(meterId)) {
        if (!duplicateIds.includes(meterId)) {
          duplicateIds.push(meterId);
        }
      } else {
        seenIds.add(meterId);
        meterIds.push({ id: meterId });
      }
    }

    if (meterIds.length === 0) {
      return {
        success: false,
        data: [],
        duplicates: duplicateIds.length > 0 ? duplicateIds : [],
        error:
          duplicateIds.length > 0
            ? `All ${duplicateIds.length} meter IDs already exist in the group`
            : "No valid meter IDs found in the file",
      };
    }

    return {
      success: true,
      data: meterIds,
      duplicates: duplicateIds,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      duplicates: [],
      error: `Failed to process file data: ${(error as Error).message}`,
    };
  }
}

//usemeterselection.ts
import { useState, useEffect } from "react";
import { useListAllMeters } from "@/lib/services/api/dashboard/Meters/hooks/useListMeters";

interface UseMeterSelectionProps {
  isEditMode: boolean;
  initialMeterIds?: string[];
}

export function useMeterSelection({
  isEditMode,
  initialMeterIds = [],
}: UseMeterSelectionProps) {
  const { data: allMeters, isLoading: metersLoading } = useListAllMeters();
  const [meterOptions, setMeterOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [fileUploadedMeterIds, setFileUploadedMeterIds] = useState<Set<string>>(
    new Set()
  );
  const [dropdownSelectedMeterIds, setDropdownSelectedMeterIds] = useState<
    Set<string>
  >(new Set());
  const [existingMeterIds] = useState<Set<string>>(() => {
    if (isEditMode) {
      return new Set(initialMeterIds.map(String));
    }
    return new Set();
  });

  useEffect(() => {
    if (!allMeters?.items) return;

    const uploaded = fileUploadedMeterIds;
    const selected = dropdownSelectedMeterIds;
    const existing = existingMeterIds;

    const availableMeters = allMeters.items.filter((m) => {
      const id = String(m.id);
      if (isEditMode) {
        return !existing.has(id) && !uploaded.has(id) && !selected.has(id);
      }
      return !uploaded.has(id) && !selected.has(id);
    });

    setMeterOptions(
      availableMeters.map((m) => ({ value: String(m.id), label: String(m.id) }))
    );
  }, [
    allMeters,
    existingMeterIds,
    fileUploadedMeterIds,
    dropdownSelectedMeterIds,
    isEditMode,
  ]);

  const newAddedMeters = Array.from(
    new Set([...fileUploadedMeterIds, ...dropdownSelectedMeterIds])
  );
  const totalSelectedMeters = isEditMode
    ? existingMeterIds.size + newAddedMeters.length
    : newAddedMeters.length;

  const displayedMeterIds = Array.from(
    new Set([...fileUploadedMeterIds, ...dropdownSelectedMeterIds])
  );

  const mergedMeterIds = isEditMode
    ? [
        ...Array.from(existingMeterIds),
        ...Array.from(fileUploadedMeterIds),
        ...Array.from(dropdownSelectedMeterIds),
      ]
    : [
        ...Array.from(fileUploadedMeterIds),
        ...Array.from(dropdownSelectedMeterIds),
      ];

  const uniqueMergedIds = Array.from(new Set(mergedMeterIds));

  return {
    meterOptions,
    metersLoading,
    fileUploadedMeterIds,
    setFileUploadedMeterIds,
    dropdownSelectedMeterIds,
    setDropdownSelectedMeterIds,
    existingMeterIds,
    totalSelectedMeters,
    displayedMeterIds,
    uniqueMergedIds,
  };
}
//meterfilehandler.ts
import { validateAndExtractMeterIds } from "@/utils/common/fileParser";

interface FileParseResult {
  success: boolean;
  data: Array<{ id: number }>;
  duplicates: number[];
  error?: string;
}

export function handleMeterFileUpload(
  parsed: FileParseResult,
  existingMeterIds: Set<string>,
  callbacks: {
    onSuccess: (ids: Set<string>) => void;
    onError: (message: string) => void;
    onWarning: (message: string) => void;
  }
) {
  if (!parsed?.data?.length) return;

  const existingIds = Array.from(existingMeterIds).map(Number);
  const result: FileParseResult = validateAndExtractMeterIds(
    Object.keys(parsed.data[0] || {}),
    parsed.data,
    existingIds
  );

  if (!result.success) {
    let errorMsg = result.error || "Failed to parse file";
    if (result.duplicates.length > 0) {
      const duplicateCount = result.duplicates.length;
      const plural = duplicateCount === 1 ? "" : "s";
      errorMsg += ` - ${duplicateCount} duplicate meter${plural} found`;
    }
    callbacks.onError(errorMsg);
    return;
  }

  if (result.duplicates.length > 0) {
    const duplicateCount = result.duplicates.length;
    const parsedCount = result.data.length;
    const pluralDup = duplicateCount === 1 ? "" : "s";
    const pluralParsed = parsedCount === 1 ? "" : "s";
    const msg = `${duplicateCount} duplicate meter${pluralDup} found and removed. Parsed ${parsedCount} new meter${pluralParsed}.`;
    callbacks.onWarning(msg);
  }

  const ids = new Set(result.data.map((m) => String(m.id)));
  callbacks.onSuccess(ids);
}

export function handleDropdownSelectionChange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any,
  setDropdownSelectedMeterIds: (ids: Set<string>) => void
) {
  if (!options) {
    setDropdownSelectedMeterIds(new Set());
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids = (Array.isArray(options) ? options : [options]).map((o: any) =>
    String(o.value)
  );
  setDropdownSelectedMeterIds(new Set(ids));
}

// edit/inner.tsx

"use client";

import {
  ButtonGroup,
  Separator,
  useAppForm,
} from "@arqiva/react-component-lib";
import { createGroupSchema } from "@/lib/services/api/dashboard/Groups/models/createGroup";
import CreateAndEditGroupFieldGroup from "../../_components/CreateAndEditFieldGroup";
import groupsService from "@/lib/services/api/dashboard/Groups/api";
import CancelAlertDialog from "@/app/_components/CancelAlertDialog";
import {
  getFormattedFormValidationErrors,
  isAPIResponseError,
} from "@/lib/services/api/dashboard/shared";
import { useRouter } from "next/navigation";
import { useToastNotifications } from "@/hooks/useToastNotifications";
import routes from "@/lib/routes";
import type { GetGroupMetersResponse } from "@/lib/services/api/dashboard/Meters/models/getGroupMeters";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface GroupDetails {
  description?: string | null;
  created_by?: string | null;
  list_of_meters?: number[];
}

interface EditGroupInnerProps {
  id: number;
  group: Awaited<ReturnType<typeof groupsService.getById>> & GroupDetails;
  initialGroupMetersData?: GetGroupMetersResponse;
}

export default function EditGroupInner({
  id,
  group,
  initialGroupMetersData,
}: EditGroupInnerProps) {
  const router = useRouter();
  const toast = useToastNotifications();
  const queryClient = useQueryClient();
  const [removedMeterIds, setRemovedMeterIds] = useState<Set<number>>(
    new Set()
  );

  const existingMeterIds = group.list_of_meters?.map(String) ?? [];

  const form = useAppForm({
    validators: { onSubmit: createGroupSchema },
    defaultValues: {
      name: group.name ?? "",
      description: group.description ?? "",
      created_by: group.created_by ?? "kavya.babu@arqiva.com",
      meterId: existingMeterIds,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const parsed = createGroupSchema.parse(value);
        const selectedMeterIds = parsed.meterId?.map(String) ?? [];

        const add_meter_ids = selectedMeterIds
          .filter((id) => !existingMeterIds.includes(id))
          .map(Number);

        const remove_meter_ids = Array.from(removedMeterIds);

        const payload = {
          group_id: id,
          name: parsed.name,
          description: parsed.description,
          add_meter_ids: add_meter_ids.length > 0 ? add_meter_ids : null,
          remove_meter_ids:
            remove_meter_ids.length > 0 ? remove_meter_ids : null,
        } as const;

        await groupsService.update(payload);

        queryClient.removeQueries({
          queryKey: ["groups", id, "meters"],
        });

        router.push(routes.dashboard.groups.root);
        router.refresh();
      } catch (err: unknown) {
        const validationErrors = getFormattedFormValidationErrors(err);
        if (validationErrors) formApi.setErrorMap(validationErrors);

        if (isAPIResponseError(err)) {
          const serverMessage =
            (err as { cause?: { message?: string }; message?: string })?.cause
              ?.message ||
            (err as { message?: string })?.message ||
            "Unknown API error";
          toast.error(`Failed to update group: ${serverMessage}`);
        }
        return err;
      }
    },
  });

  const handleRemoveMeter = (meterId: number) => {
    setRemovedMeterIds((prev) => new Set([...prev, meterId]));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppForm>
        <form.ErrorMessage />

        <CreateAndEditGroupFieldGroup
          form={form}
          groupId={id}
          initialGroupMetersData={initialGroupMetersData}
          removedMeterIds={removedMeterIds}
          onRemoveMeter={handleRemoveMeter}
        />

        <Separator />

        <ButtonGroup justify="between">
          <CancelAlertDialog />
          <form.SubmitButton>Save Changes</form.SubmitButton>
        </ButtonGroup>
      </form.AppForm>
    </form>
  );
}

help me to fix bug
In edit mode, If file upload contains duplicates + valid meters → it should still add valid meters still get inserted to FE state but if its warning or error gets ignored.
