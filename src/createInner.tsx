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
