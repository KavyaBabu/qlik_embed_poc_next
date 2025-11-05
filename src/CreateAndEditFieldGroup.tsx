"use client";

import dynamic from "next/dynamic";
import {
  withFieldGroup,
  createDefaultFieldValidators,
} from "@arqiva/react-component-lib";
import { createGroupSchema } from "@/lib/services/api/dashboard/Groups/models/createGroup";

const FileUpload = dynamic(
  () =>
    import("@arqiva/react-component-lib")
      .then((mod) => mod.FileUpload)
      .catch((err) => {
        throw err;
      }),
  { ssr: false }
);

//TODO: replace them with actual options from API
const meterOptions = [
  { value: "523581134", label: "523581134" },
  { value: "336903430", label: "336903430" },
  { value: "795366496", label: "795366496" },
  { value: "919811200", label: "919811200" },
  { value: "340068532", label: "340068532" },
  { value: "883276265", label: "883276265" },
  { value: "830866255", label: "830866255" },
  { value: "973548020", label: "973548020" },
  { value: "342963428", label: "342963428" },
  { value: "700215083", label: "700215083" },
  { value: "292381761", label: "292381761" },
  { value: "386439614", label: "386439614" },
  { value: "296723952", label: "296723952" },
  { value: "429939057", label: "429939057" },
  { value: "800165147", label: "800165147" },
  { value: "228476443", label: "228476443" },
  { value: "693571419", label: "693571419" },
  { value: "992999991", label: "992999991" },
  { value: "936212291", label: "936212291" },
  { value: "275353451", label: "275353451" },
  { value: "706601234", label: "706601234" },
  { value: "792002287", label: "792002287" },
  { value: "598213530", label: "598213530" },
  { value: "850481180", label: "850481180" },
  { value: "218588800", label: "218588800" },
  { value: "501695523", label: "501695523" },
  { value: "547853866", label: "547853866" },
  { value: "576008595", label: "576008595" },
  { value: "525185337", label: "525185337" },
  { value: "975426211", label: "975426211" },
  { value: "882841636", label: "882841636" },
  { value: "766432167", label: "766432167" },
  { value: "951324021", label: "951324021" },
  { value: "217635274", label: "217635274" },
  { value: "338741324", label: "338741324" },
  { value: "860847473", label: "860847473" },
  { value: "783183663", label: "783183663" },
];

interface CreateGroupFields {
  name: string;
  description: string;
  created_by: string;
  meterId: string[];
  file?: File;
  customer_id?: string;
}

const CreateAndEditGroupFieldGroupComponent = withFieldGroup<
  CreateGroupFields,
  CreateGroupFields
>({
  render: function Render({ group }) {
    return (
      <>
        <group.AppField
          name="name"
          validators={createDefaultFieldValidators(
            createGroupSchema.shape.name
          )}
        >
          {(field) => <field.TextField label="Name" placeholder="Group Name" />}
        </group.AppField>

        <group.AppField
          name="description"
          validators={createDefaultFieldValidators(
            createGroupSchema.shape.description
          )}
        >
          {(field) => (
            <field.TextareaField
              label="Description (optional)"
              placeholder="Write a short description for your group."
              rows={5}
            />
          )}
        </group.AppField>

        <group.AppField
          name="file"
          validators={createDefaultFieldValidators(
            createGroupSchema.shape.file
          )}
        >
          {(field) => (
            <FileUpload
              placeholder="Upload CSV / TXT (meter IDs)"
              accept=".csv,.txt,.xls,.xlsx"
              parseFile
              onFileSelect={(f) => field.setValue(f as File | undefined)}
              onFileRemove={() => field.setValue(undefined)}
              onFileParse={(parsed) => {
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

                const currentSelected =
                  (field.form.getFieldValue("meterId") as string[]) || [];
                const merged = Array.from(
                  new Set([...currentSelected, ...parsedIds])
                );
                field.form.setFieldValue("meterId", merged);
              }}
            />
          )}
        </group.AppField>

        <group.AppField
          name="meterId"
          validators={createDefaultFieldValidators(
            createGroupSchema.shape.meterId
          )}
        >
          {(field) => (
            <div style={{ marginTop: "var(--spacing-3xl)" }}>
              <field.SearchableSelectField
                label="Meter ID"
                placeholder="Select a meter"
                options={meterOptions}
                isClearable
                isMulti
              />
            </div>
          )}
        </group.AppField>
      </>
    );
  },
});

function CreateAndEditGroupFieldGroup({ form }: { form: unknown }) {
  return (
    <CreateAndEditGroupFieldGroupComponent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form={form as any}
      fields={
        {
          name: "name",
          description: "description",
          created_by: "created_by",
          meterId: "meterId",
          file: "file",
          customer_id: "customer_id",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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


// createInner.tsx
"use client";

import {
  ButtonGroup,
  Separator,
  useAppForm,
} from "@arqiva/react-component-lib";
import {
  createGroupSchema,
  toCreateGroupApiBody,
} from "@/lib/services/api/dashboard/Groups/models/createGroup";
import CreateAndEditGroupFieldGroup from "../_components/CreateAndEditFieldGroup";
import groupsService from "@/lib/services/api/dashboard/Groups/api";
import CancelAlertDialog from "@/app/_components/CancelAlertDialog";
import {
  getFormattedFormValidationErrors,
  isAPIResponseError,
} from "@/lib/services/api/dashboard/shared";
import { useRouter } from "next/navigation";
import { useToastNotifications } from "@/hooks/useToastNotifications";
import routes from "@/lib/routes";

const CURRENT_USER_EMAIL_FALLBACK = "kavya.babu@arqiva.com";

export default function CreateGroupInner() {
  const router = useRouter();
  const toast = useToastNotifications();

  const form = useAppForm({
    validators: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSubmit: createGroupSchema as any,
    },
    defaultValues: {
      name: "",
      description: "",
      file: undefined as File | undefined,
      meterId: [] as string[],
      created_by: CURRENT_USER_EMAIL_FALLBACK,
      customer_id: undefined as string | undefined,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const parsed = createGroupSchema.parse(value);
        const payload = {
          ...toCreateGroupApiBody(parsed),
          created_by: parsed.created_by,
          description: parsed.description,
          customer_id: "TEST1",
        };

        await groupsService.create(payload);
        router.push(routes.dashboard.groups.root);
      } catch (err: unknown) {
        const validationErrors = getFormattedFormValidationErrors(err);
        if (validationErrors) {
          formApi.setErrorMap(validationErrors);
        }

        if (isAPIResponseError(err)) {
          const serverMessage =
            (err as { cause?: { message?: string }; message?: string })?.cause
              ?.message ||
            (err as { message?: string })?.message ||
            "Unknown API error";

          toast.error(`Failed to create group: ${serverMessage}`);
        }

        return err;
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppForm>
        <form.ErrorMessage />

        <CreateAndEditGroupFieldGroup form={form} />

        <Separator />

        <ButtonGroup justify="between">
          <CancelAlertDialog />
          <form.SubmitButton>Create Group</form.SubmitButton>
        </ButtonGroup>
      </form.AppForm>
    </form>
  );
}

// editInner.tsx

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

interface GroupDetails {
  description?: string;
  created_by?: string;
  list_of_meters?: string[];
}

interface EditGroupInnerProps {
  id: number;
  group: Awaited<ReturnType<typeof groupsService.getById>> & GroupDetails;
}

export default function EditGroupInner({ id, group }: EditGroupInnerProps) {
  const router = useRouter();
  const toast = useToastNotifications();

  const form = useAppForm({
    validators: {
      onSubmit: createGroupSchema,
    },
    defaultValues: {
      name: group.name ?? "",
      description: group.description ?? "",
      created_by: group.created_by ?? "kavya.babu@arqiva.com",
      meterId: group.list_of_meters?.map(String) ?? [],
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const parsed = createGroupSchema.parse(value);

        const existingMeterIds = group.list_of_meters?.map(String) ?? [];
        const updatedMeterIds = parsed.meterId?.map(String) ?? [];

        const add_meter_ids = updatedMeterIds.filter(
          (id) => !existingMeterIds.includes(id)
        );
        const remove_meter_ids = existingMeterIds.filter(
          (id) => !updatedMeterIds.includes(id)
        );

        const payload = {
          group_id: id,
          name: parsed.name,
          description: parsed.description,
          add_meter_ids: add_meter_ids.map(Number),
          remove_meter_ids: remove_meter_ids.map(Number),
        };

        await groupsService.update(payload);
        router.push(routes.dashboard.groups.root);
      } catch (err: unknown) {
        const validationErrors = getFormattedFormValidationErrors(err);
        if (validationErrors) {
          formApi.setErrorMap(validationErrors);
        }

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppForm>
        <form.ErrorMessage />

        <CreateAndEditGroupFieldGroup form={form} />

        <Separator />

        <ButtonGroup justify="between">
          <CancelAlertDialog />
          <form.SubmitButton>Save Changes</form.SubmitButton>
        </ButtonGroup>
      </form.AppForm>
    </form>
  );
}

