"use client";

import dynamic from "next/dynamic";
import {
  withFieldGroup,
  createDefaultFieldValidators,
  QueryParams,
  Message,
  Button,
} from "@arqiva/react-component-lib";
import { createGroupSchema } from "@/lib/services/api/dashboard/Groups/models/createGroup";
import { useListAllMeters } from "@/lib/services/api/dashboard/Meters/hooks/useListMeters";
import { useEffect, useState, useCallback } from "react";
import { List } from "@/lib/services/api/dashboard/Meters/components/List";
import type { GetGroupMetersResponse } from "@/lib/services/api/dashboard/Meters/models/getGroupMeters";
import SearchQueryFilter, {
  searchQueryFilterOverride,
} from "@/lib/services/common/SearchQueryFilter";

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
  meterId: string[];
  file?: File;
  customer_id?: string;
}

function CreateAndEditGroupFieldGroup({
  form,
  groupId,
  initialGroupMetersData,
}: {
  form: unknown;
  groupId?: number;
  initialGroupMetersData?: GetGroupMetersResponse;
}) {
  const isEditMode = !!groupId;

  const FieldGroup = withFieldGroup<CreateGroupFields, CreateGroupFields>({
    render: ({ group }: any) => {
      const { data: allMeters, isLoading: metersLoading } = useListAllMeters();
      const [meterOptions, setMeterOptions] = useState<Array<{ value: string; label: string }>>([]);
      
      const [fileUploadedMeterIds, setFileUploadedMeterIds] = useState<Set<string>>(new Set());
      const [dropdownSelectedMeterIds, setDropdownSelectedMeterIds] = useState<Set<string>>(new Set());
      const [existingMeterIds, setExistingMeterIds] = useState<Set<string>>(new Set());
      const [isInitialized, setIsInitialized] = useState(false);

      useEffect(() => {
        if (isEditMode && !isInitialized) {
          const currentFormValue = group.form.getFieldValue("meterId") as string[] || [];
          setExistingMeterIds(new Set(currentFormValue));
          setIsInitialized(true);
        }
      }, [isEditMode, group.form, isInitialized]);

      useEffect(() => {
        if (allMeters?.items && Array.isArray(allMeters.items)) {
          const options = allMeters.items
            .map((meter) => ({
              value: String(meter.id),
              label: String(meter.id),
            }));

          setMeterOptions(options);
        }
      }, [allMeters]);

      const updateFormMeterIds = useCallback(
        (fileIds: Set<string>, dropdownIds: Set<string>) => {
            const newMeters = Array.from(
            new Set([...fileIds, ...dropdownIds])
          );
          group.form.setFieldValue("meterId", newMeters);
        },
        [group.form]
      );

      const handleFileParse = (parsed: any) => {
        if (
          !parsed?.data ||
          !Array.isArray(parsed.data) ||
          parsed.data.length === 0
        )
          return;

        type ParsedRow = {
          meter_id?: string | number | null;
        };

        const parsedIds = (parsed.data as ParsedRow[])
          .map((row) =>
            row.meter_id ? String(row.meter_id).trim() : ""
          )
          .filter(Boolean);

        const newFileIds = new Set(parsedIds);
        setFileUploadedMeterIds(newFileIds);
        
        updateFormMeterIds(newFileIds, dropdownSelectedMeterIds);
      };

      const handleDropdownChange = (selectedOptions: any) => {
        if (!selectedOptions) {
          setDropdownSelectedMeterIds(new Set());
          updateFormMeterIds(fileUploadedMeterIds, new Set());
          return;
        }

        const selectedIds = Array.isArray(selectedOptions)
          ? selectedOptions.map((opt: any) => String(opt.value))
          : [String(selectedOptions.value)];

        const newDropdownIds = new Set(selectedIds);
        setDropdownSelectedMeterIds(newDropdownIds);
        
        updateFormMeterIds(fileUploadedMeterIds, newDropdownIds);
      };

      const newAddedMeters = Array.from(
        new Set([...fileUploadedMeterIds, ...dropdownSelectedMeterIds])
      );
      
      const totalSelectedMeters = isEditMode
        ? existingMeterIds.size + newAddedMeters.length
        : newAddedMeters.length;

      return (
        <>
          <group.AppField
            name="name"
            validators={createDefaultFieldValidators(
              createGroupSchema.shape.name
            )}
          >
            {(field: any) => <field.TextField label="Name" placeholder="Group Name" />}
          </group.AppField>

          <group.AppField
            name="description"
            validators={createDefaultFieldValidators(
              createGroupSchema.shape.description
            )}
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
            <div style={{
              marginBottom: "var(--spacing-3xl)",
              maxWidth: "600px",
              width: "100%"
            }}>
              <h6 style={{ marginBottom: "var(--spacing-lg)" }}>
                Current Meters in Group
              </h6>

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
                          filterOverrides={{
                            ...searchQueryFilterOverride,
                          }}
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
            validators={createDefaultFieldValidators(
              createGroupSchema.shape.file
            )}
          >
            {(field: any) => (
              <FileUpload
                placeholder={isEditMode ? "Upload CSV / TXT to add meters" : "Upload CSV / TXT (meter IDs)"}
                accept=".csv,.txt,.xls,.xlsx"
                parseFile
                onFileSelect={(file: File | null) => field.setValue(file ?? undefined)}
                onFileRemove={() => {
                  field.setValue(undefined);
                  setFileUploadedMeterIds(new Set());
                  updateFormMeterIds(new Set(), dropdownSelectedMeterIds);
                }}
                onFileParse={handleFileParse}
              />
            )}
          </group.AppField>

          {isEditMode && totalSelectedMeters > 0 && (
            <Message.Root variant="info" style={{ marginTop: "var(--spacing-lg)", marginBottom: "var(--spacing-lg)" }}>
              <Message.Title>Meter Selection Summary</Message.Title>
              <Message.Description>
                <div style={{ lineHeight: "1.6" }}>
                  <div>
                    <strong>Total meters:</strong> {totalSelectedMeters}
                  </div>
                  {existingMeterIds.size > 0 && (
                    <div>
                      <strong>Existing meters:</strong> {existingMeterIds.size}
                    </div>
                  )}
                  {newAddedMeters.length > 0 && (
                    <div>
                      <strong>New meters to add:</strong> {newAddedMeters.length}
                      {fileUploadedMeterIds.size > 0 && ` (${fileUploadedMeterIds.size} from file`}
                      {fileUploadedMeterIds.size > 0 && dropdownSelectedMeterIds.size > 0 && `, `}
                      {dropdownSelectedMeterIds.size > 0 && `${dropdownSelectedMeterIds.size} from selection)`}
                    </div>
                  )}
                  {existingMeterIds.size === 0 && newAddedMeters.length === 0 && (
                    <div style={{ color: "#999" }}>No meters selected</div>
                  )}
                </div>
              </Message.Description>
            </Message.Root>
          )}

          {!isEditMode && totalSelectedMeters > 0 && (
            <Message.Root variant="info" style={{ marginTop: "var(--spacing-lg)", marginBottom: "var(--spacing-lg)" }}>
              <Message.Title>Meter Selection</Message.Title>
              <Message.Description>
                <div style={{ lineHeight: "1.6" }}>
                  <div>
                    <strong>Total meters selected:</strong> {totalSelectedMeters}
                  </div>
                  {fileUploadedMeterIds.size > 0 && (
                    <div>
                      <strong>From file upload:</strong> {fileUploadedMeterIds.size}
                    </div>
                  )}
                  {dropdownSelectedMeterIds.size > 0 && (
                    <div>
                      <strong>From manual selection:</strong> {dropdownSelectedMeterIds.size}
                    </div>
                  )}
                </div>
              </Message.Description>
            </Message.Root>
          )}

          <group.AppField
            name="meterId"
            validators={createDefaultFieldValidators(
              createGroupSchema.shape.meterId
            )}
          >
            {(field: any) => (
              <div style={{ marginTop: "var(--spacing-3xl)" }}>
                <field.SearchableSelectField
                  label="Meter ID"
                  placeholder={
                    metersLoading ? "Loading meters..." : "Select a meter"
                  }
                  options={meterOptions}
                  isClearable
                  isMulti
                  isLoading={metersLoading}
                  onChange={handleDropdownChange}
                  value={Array.from(dropdownSelectedMeterIds).map((id) => ({
                    value: id,
                    label: id,
                  }))}
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
      fields={
        {
          name: "name",
          description: "description",
          created_by: "created_by",
          meterId: "meterId",
          file: "file",
          customer_id: "customer_id",
        } as any
      }
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

