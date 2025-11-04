"use client";

import {
  Button,
  Table,
  DataTable,
  getPaginationPropsFromQuery,
  useQueryParams,
  QueryParams,
} from "@arqiva/react-component-lib";
import { createColumns } from "./columns";
import type {
  GetGroupMetersResponse,
  GetGroupMetersQuery,
} from "../../models/getGroupMeters";
import { useListGroupMeters } from "../../hooks/useListGroupMeters";
import { isQueryLoading } from "@/utils/query/isQueryLoading";
import Error from "@/lib/services/api/_components/Error";

interface ListProps {
  groupId: number;
  groupName?: string;
  groupDescription?: string | null;
  initialData?: GetGroupMetersResponse;
  children?: ({
    resultsLoading,
    resultsCount,
  }: {
    resultsLoading: boolean;
    resultsCount: number;
  }) => React.ReactNode;
}

export const List = ({
  groupId,
  groupName,
  groupDescription,
  initialData,
  children,
}: ListProps) => {
  const { queryParams, clearAllParams } = useQueryParams<GetGroupMetersQuery>();
  const query = useListGroupMeters({
    groupId,
    queryParameters: queryParams,
    initialData,
  });

  if (query.error) {
    return (
      <Error error={query.error as Error} refetchOptions={query.refetch} />
    );
  }

  const isLoading = isQueryLoading(query);
  const columns = createColumns(groupId, groupName, groupDescription);

  return (
    <Table.Wrapper>
      {children?.({
        resultsLoading: isLoading,
        resultsCount: query.data?.totalItems ?? 0,
      })}

      <DataTable
        columns={columns}
        data={query.data?.meters ?? []}
        isLoading={isLoading}
        loader={{
          pageLength: queryParams?.perPage ?? 10,
          widths: ["sm"],
        }}
        empty={
          <Table.Empty.Root>
            <Table.Empty.Title>No Meters Found</Table.Empty.Title>
            <Table.Empty.Description>
              No meters match the current search.
            </Table.Empty.Description>
            <Table.Empty.Actions>
              <Button onClick={() => clearAllParams()}>Clear Search</Button>
            </Table.Empty.Actions>
          </Table.Empty.Root>
        }
        sortByComponent={(column) => <QueryParams.Table.Sort column={column} />}
        paginationComponent={
          <QueryParams.Table.Pagination
            // @ts-expect-error totalItems may be undefined from API but handled at runtime
            {...getPaginationPropsFromQuery(query, queryParams?.perPage)}
          />
        }
      />
    </Table.Wrapper>
  );
};

export default List;
