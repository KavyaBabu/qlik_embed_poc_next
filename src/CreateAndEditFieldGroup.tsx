"use client";

import dynamic from "next/dynamic";
import {
  withFieldGroup,
  createDefaultFieldValidators,
  QueryParams,
  Message,
} from "@arqiva/react-component-lib";
import { createGroupSchema } from "@/lib/services/api/dashboard/Groups/models/createGroup";
import { useListAllMeters } from "@/lib/services/api/dashboard/Meters/hooks/useListMeters";
import { useEffect, useState, useCallback, useRef } from "react";
import { List } from "@/lib/services/api/dashboard/Meters/components/List";
import type { GetGroupMetersResponse } from "@/lib/services/api/dashboard/Meters/models/getGroupMeters";
import SearchQueryFilter, {
  searchQueryFilterOverride,
} from "@/lib/services/common/SearchQueryFilter";
import { useToastNotifications } from "@/hooks/useToastNotifications";

const FileUpload = dynamic(
  () =>
    import("@arqiva/react-component-lib")
      .then((mod) => mod.FileUpload)
      .catch((err) => {
        throw err;
      }),
  { ssr: false }
);

interface CreateGroupFields {
  name: string;
  description: string;
  created_by: string;
  meterId: string[]; // IMPORTANT: in edit-mode this holds **only new** meter IDs
  file?: File;
  customer_id?: string;
}

function CreateAndEditGroupFieldGroup({
  form,
  groupId,
  initialGroupMetersData,
  existingMetersInitial,
}: {
  form: unknown;
  groupId?: number;
  initialGroupMetersData?: GetGroupMetersResponse;
  existingMetersInitial?: string[];
}) {
  const isEditMode = !!groupId;

  const FieldGroup = withFieldGroup<CreateGroupFields, CreateGroupFields>({
    render: ({ group }: any) => {
      const { data: allMeters, isLoading: metersLoading } = useListAllMeters();
      const toast = useToastNotifications();

      const [meterOptions, setMeterOptions] = useState<Array<{ value: string; label: string }>>([]);
      const [fileUploadedMeterIds, setFileUploadedMeterIds] = useState<Set<string>>(new Set());
      const [dropdownSelectedMeterIds, setDropdownSelectedMeterIds] = useState<Set<string>>(new Set());

      // Snapshot existing IDs once via ref so remounts don't reset
      const existingSnapshotRef = useRef<Set<string>>(new Set(existingMetersInitial ?? (() => {
        const initial = (group.form.getFieldValue("meterId") as string[]) || [];
        return initial;
      })()));

      // Helpers
      const union = (a: Set<string>, b: Set<string>) => {
        const out = new Set<string>(a);
        b.forEach((v) => out.add(v));
        return out;
      };
      const toUnique = (arr: string[]) => Array.from(new Set(arr));

      // Build dropdown options, optionally hiding already-existing meters in edit mode
      useEffect(() => {
        if (allMeters?.items && Array.isArray(allMeters.items)) {
          const options = allMeters.items
            .map((meter) => ({ value: String(meter.id), label: String(meter.id) }))
            .filter((opt) => !isEditMode || !existingSnapshotRef.current.has(opt.value));
          setMeterOptions(options);
        }
      }, [allMeters, isEditMode]);

      // Update the form value: in edit mode, store ONLY truly-new IDs; in create, store all selections
      const updateFormMeterIds = useCallback(
        (fileIds: Set<string>, dropdownIds: Set<string>) => {
          const combined = union(fileIds, dropdownIds);
          const newOnly = isEditMode
            ? Array.from(combined).filter((id) => !existingSnapshotRef.current.has(id))
            : Array.from(combined);

          group.form.setFieldValue("meterId", newOnly);
        },
        [group.form, isEditMode]
      );

      const handleFileParse = (parsed: any) => {
        console.log("[DEBUG] handleFileParse called with parsed:", parsed);
        if (!parsed?.data || !Array.isArray(parsed.data) || parsed.data.length === 0) return;

        type ParsedRow = { meter_id?: string | number | null };
        const raw = (parsed.data as ParsedRow[])
          .map((row) => (row.meter_id ? String(row.meter_id).trim() : ""))
          .filter(Boolean);

        const newUniqueFileIds = new Set(raw);

        // Deduplicate across existing and dropdown
        const alreadyChosen = union(dropdownSelectedMeterIds, isEditMode ? existingSnapshotRef.current : new Set());
        const trulyNew = Array.from(newUniqueFileIds).filter((id) => !alreadyChosen.has(id));

        const duplicatesInFile = raw.length - newUniqueFileIds.size;
        const alreadyExisting = raw.filter((id) => alreadyChosen.has(id));

        if (duplicatesInFile > 0 || alreadyExisting.length > 0) {
          const parts: string[] = [];
          if (duplicatesInFile > 0) parts.push(`${duplicatesInFile} duplicate${duplicatesInFile > 1 ? "s" : ""} in file`);
          if (alreadyExisting.length > 0) parts.push(`${alreadyExisting.length} already selected/existing`);
          toast.error(`Ignored ${parts.join(" and ")}. Using unique, non-duplicate IDs.`);
        }

        if (trulyNew.length > 0) {
          toast.success(`Added ${trulyNew.length} unique meter ID${trulyNew.length > 1 ? "s" : ""} from file.`);
        }

        // Merge file IDs instead of replacing them
        const newFileIds = new Set(trulyNew);
        const merged = union(fileUploadedMeterIds, newFileIds);
        console.log("[DEBUG] Before setFileUploadedMeterIds, merged:", merged);
        setFileUploadedMeterIds(merged);
        updateFormMeterIds(merged, dropdownSelectedMeterIds);
        updateFormMeterIds(merged, dropdownSelectedMeterIds);
        console.log("[DEBUG] After setFileUploadedMeterIds, fileUploadedMeterIds:", fileUploadedMeterIds);
      };

      const handleDropdownChange = (selectedOptions: any) => {
        console.log("[DEBUG] handleDropdownChange called with selectedOptions:", selectedOptions);
        const selectedIds = !selectedOptions
          ? []
          : Array.isArray(selectedOptions)
          ? selectedOptions.map((opt: any) => String(opt.value))
          : [String(selectedOptions.value)];

        // De-dup against file selections and (in edit) existing meters
        const alreadyChosen = union(fileUploadedMeterIds, isEditMode ? existingSnapshotRef.current : new Set());
        const uniqueIds: string[] = [];
        const dupes: string[] = [];
        for (const id of selectedIds) {
          if (alreadyChosen.has(id) || uniqueIds.includes(id)) dupes.push(id);
          else uniqueIds.push(id);
        }
        if (dupes.length > 0) {
          const display = toUnique(dupes);
          toast.error(`Ignored ${display.length} duplicate selection${display.length > 1 ? "s" : ""}.`);
        }

        const newDropdownIds = new Set(uniqueIds);
        console.log("[DEBUG] Before setDropdownSelectedMeterIds, newDropdownIds:", newDropdownIds);
        setDropdownSelectedMeterIds(newDropdownIds);
        updateFormMeterIds(fileUploadedMeterIds, newDropdownIds);
        console.log("[DEBUG] After setDropdownSelectedMeterIds, dropdownSelectedMeterIds:", dropdownSelectedMeterIds);
      };

      // Presentation counts
      const rawNewAdds = Array.from(union(fileUploadedMeterIds, dropdownSelectedMeterIds));
      const newAddsExcludingExisting = rawNewAdds.filter((id) => !existingSnapshotRef.current.has(id));
      const fileNewCount = Array.from(fileUploadedMeterIds).filter((id) => !existingSnapshotRef.current.has(id)).length;
      const dropdownNewCount = Array.from(dropdownSelectedMeterIds).filter((id) => !existingSnapshotRef.current.has(id)).length;

      const totalSelectedMeters = isEditMode
        ? existingSnapshotRef.current.size + newAddsExcludingExisting.length
        : rawNewAdds.length;

      console.log("[DEBUG] Render: fileUploadedMeterIds", fileUploadedMeterIds, "dropdownSelectedMeterIds", dropdownSelectedMeterIds, "meterOptions", meterOptions);
      return (
        <>
          <group.AppField
            name="name"
            validators={createDefaultFieldValidators(createGroupSchema.shape.name)}
          >
            {(field: any) => <field.TextField label="Name" placeholder="Group Name" />}
          </group.AppField>

          <group.AppField
            name="description"
            validators={createDefaultFieldValidators(createGroupSchema.shape.description)}
          >
            {(field: any) => (
              <field.TextareaField
                label="Description (optional)"
                placeholder="Write a short description for your group."
                rows={5}
              />
            )}
          </group.AppField>

          {isEditMode && (
            <div style={{ marginBottom: "var(--spacing-3xl)", maxWidth: "600px", width: "100%" }}>
              <h6 style={{ marginBottom: "var(--spacing-lg)" }}>Current Meters in Group</h6>
              <QueryParams.Root>
                <div style={{ width: "100%", maxWidth: "100%" }}>
                  <List
                    groupId={groupId}
                    groupName={group.form.getFieldValue("name")}
                    groupDescription={group.form.getFieldValue("description")}
                    initialData={initialGroupMetersData}
                  >
                    {({ resultsLoading, resultsCount }) => (
                      <QueryParams.Params.Root>
                        <SearchQueryFilter placeholder="Search meters" />
                        <QueryParams.Params.SelectedValues
                          resultsLoading={resultsLoading}
                          resultsCount={resultsCount}
                          filterOverrides={{ ...searchQueryFilterOverride }}
                        />
                      </QueryParams.Params.Root>
                    )}
                  </List>
                </div>
              </QueryParams.Root>
            </div>
          )}

          <group.AppField
            name="file"
            validators={createDefaultFieldValidators(createGroupSchema.shape.file)}
          >
            {(field: any) => (
              <FileUpload
                placeholder={isEditMode ? "Upload CSV / TXT to add meters" : "Upload CSV / TXT (meter IDs)"}
                accept=".csv,.txt,.xls,.xlsx"
                parseFile
                onFileSelect={(file: File | null) => field.setValue(file ?? undefined)}
                onFileRemove={() => {
                  // Only clear the file input itself; keep parsed selections so counts don't reset.
                  field.setValue(undefined);
                }}
                onFileParse={handleFileParse}
              />
            )}
          </group.AppField>

          {isEditMode && totalSelectedMeters > 0 && (
            <Message.Root variant="info" style={{ marginTop: "var(--spacing-lg)", marginBottom: "var(--spacing-lg)" }}>
              <Message.Title>Meter Selection Summary</Message.Title>
              <Message.Description>
                <>
                  <span><strong>Total meters:</strong> {totalSelectedMeters}</span><br />
                  {isEditMode && existingSnapshotRef.current.size > 0 && (
                    <>
                      <span><strong>Existing meters:</strong> {existingSnapshotRef.current.size}</span><br />
                    </>
                  )}
                  {isEditMode && newAddsExcludingExisting.length > 0 && (
                    <>
                      <span>
                        <strong>New meters to add:</strong> {newAddsExcludingExisting.length}
                        {(fileNewCount > 0 || dropdownNewCount > 0) && " ("}
                        {fileNewCount > 0 && `${fileNewCount} from file`}
                        {fileNewCount > 0 && dropdownNewCount > 0 && ", "}
                        {dropdownNewCount > 0 && `${dropdownNewCount} from selection`}
                        {(fileNewCount > 0 || dropdownNewCount > 0) && ")"}
                      </span>
                    </>
                  )}
                  {!isEditMode && fileUploadedMeterIds.size > 0 && (
                    <>
                      <span><strong>From file upload:</strong> {fileUploadedMeterIds.size}</span><br />
                    </>
                  )}
                  {!isEditMode && dropdownSelectedMeterIds.size > 0 && (
                    <>
                      <span><strong>From manual selection:</strong> {dropdownSelectedMeterIds.size}</span>
                    </>
                  )}
                  {((isEditMode && existingSnapshotRef.current.size === 0 && newAddsExcludingExisting.length === 0) || (!isEditMode && totalSelectedMeters === 0)) && (
                    <span style={{ color: "#999" }}>No meters selected</span>
                  )}
                </>
              </Message.Description>
            </Message.Root>
          )}

          {!isEditMode && totalSelectedMeters > 0 && (
            <Message.Root variant="info" style={{ marginTop: "var(--spacing-lg)", marginBottom: "var(--spacing-lg)" }}>
              <Message.Title>Meter Selection</Message.Title>
              <Message.Description>
                <>
                  <span><strong>Total meters:</strong> {totalSelectedMeters}</span><br />
                  {isEditMode && existingSnapshotRef.current.size > 0 && (
                    <>
                      <span><strong>Existing meters:</strong> {existingSnapshotRef.current.size}</span><br />
                    </>
                  )}
                  {isEditMode && newAddsExcludingExisting.length > 0 && (
                    <>
                      <span>
                        <strong>New meters to add:</strong> {newAddsExcludingExisting.length}
                        {(fileNewCount > 0 || dropdownNewCount > 0) && " ("}
                        {fileNewCount > 0 && `${fileNewCount} from file`}
                        {fileNewCount > 0 && dropdownNewCount > 0 && ", "}
                        {dropdownNewCount > 0 && `${dropdownNewCount} from selection`}
                        {(fileNewCount > 0 || dropdownNewCount > 0) && ")"}
                      </span>
                    </>
                  )}
                  {!isEditMode && fileUploadedMeterIds.size > 0 && (
                    <>
                      <span><strong>From file upload:</strong> {fileUploadedMeterIds.size}</span><br />
                    </>
                  )}
                  {!isEditMode && dropdownSelectedMeterIds.size > 0 && (
                    <>
                      <span><strong>From manual selection:</strong> {dropdownSelectedMeterIds.size}</span>
                    </>
                  )}
                  {((isEditMode && existingSnapshotRef.current.size === 0 && newAddsExcludingExisting.length === 0) || (!isEditMode && totalSelectedMeters === 0)) && (
                    <span style={{ color: "#999" }}>No meters selected</span>
                  )}
                </>
              </Message.Description>
            </Message.Root>
          )}

          <group.AppField
            name="meterId"
            validators={createDefaultFieldValidators(createGroupSchema.shape.meterId)}
          >
            {(field: any) => (
              <div style={{ marginTop: "var(--spacing-3xl)" }}>
                <field.SearchableSelectField
                  label="Meter ID"
                  placeholder={metersLoading ? "Loading meters..." : "Select a meter"}
                  options={meterOptions}
                  isClearable
                  isMulti
                  isLoading={metersLoading}
                  onChange={handleDropdownChange}
                  value={Array.from(dropdownSelectedMeterIds).map((id) => ({ value: id, label: id }))}
                />
              </div>
            )}
          </group.AppField>
        </>
      );
    },
  });

  return (
    <FieldGroup
      form={form as any}
      fields={{
        name: "name",
        description: "description",
        created_by: "created_by",
        meterId: "meterId",
        file: "file",
        customer_id: "customer_id",
      } as any}
    />
  );
}

export default dynamic(
  () =>
    Promise.resolve(CreateAndEditGroupFieldGroup).catch((err) => {
      throw err;
    }),
  { ssr: false }
);



