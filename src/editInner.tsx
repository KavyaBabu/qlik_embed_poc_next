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

interface GroupDetails {
  description?: string;
  created_by?: string;
  list_of_meters?: number[];
}

interface EditGroupInnerProps {
  id: number;
  group: Awaited<ReturnType<typeof groupsService.getById>> &
    GroupDetails & {
      description?: string | undefined; 
    };
  initialGroupMetersData?: GetGroupMetersResponse;
}

export default function EditGroupInner({
  id,
  group,
  initialGroupMetersData,
}: EditGroupInnerProps) {
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

        <CreateAndEditGroupFieldGroup
          form={form}
          groupId={id}
          initialGroupMetersData={initialGroupMetersData}
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
