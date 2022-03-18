import {
  createAsyncThunk,
  createEntityAdapter,
  createSlice,
  createSelector,
  PayloadAction,
} from '@reduxjs/toolkit';
import {
  Configuration,
  ConsumerGroup,
  ConsumerGroupDetails,
  ConsumerGroupOrdering,
  ConsumerGroupsApi,
  ConsumerGroupsPageResponse,
  SortOrder,
} from 'generated-sources';
import { BASE_PARAMS } from 'lib/constants';
import { getResponse } from 'lib/errorHandling';
import {
  ClusterName,
  ConsumerGroupID,
  ConsumerGroupResetOffsetRequestParams,
  RootState,
} from 'redux/interfaces';
import { createFetchingSelector } from 'redux/reducers/loader/selectors';
import { EntityState } from '@reduxjs/toolkit/src/entities/models';

const apiClientConf = new Configuration(BASE_PARAMS);
export const api = new ConsumerGroupsApi(apiClientConf);

export const fetchConsumerGroups = createAsyncThunk<
  ConsumerGroup[],
  ClusterName
>(
  'consumerGroups/fetchConsumerGroups',
  async (clusterName: ClusterName, { rejectWithValue }) => {
    try {
      return await api.getConsumerGroups({
        clusterName,
      });
    } catch (error) {
      return rejectWithValue(await getResponse(error as Response));
    }
  }
);

export const fetchConsumerGroupsPaged = createAsyncThunk<
  ConsumerGroupsPageResponse,
  {
    clusterName: ClusterName;
    orderBy?: ConsumerGroupOrdering;
    sortOrder?: SortOrder;
  }
>(
  'consumerGroups/fetchConsumerGroupsPaged',
  async ({ clusterName, orderBy, sortOrder }, { rejectWithValue }) => {
    try {
      const response = await api.getConsumerGroupsPageRaw({
        clusterName,
        orderBy,
        sortOrder,
      });
      return await response.value();
    } catch (error) {
      return rejectWithValue(await getResponse(error as Response));
    }
  }
);

export const fetchConsumerGroupDetails = createAsyncThunk<
  ConsumerGroupDetails,
  { clusterName: ClusterName; consumerGroupID: ConsumerGroupID }
>(
  'consumerGroups/fetchConsumerGroupDetails',
  async ({ clusterName, consumerGroupID }, { rejectWithValue }) => {
    try {
      return await api.getConsumerGroup({
        clusterName,
        id: consumerGroupID,
      });
    } catch (error) {
      return rejectWithValue(await getResponse(error as Response));
    }
  }
);

export const deleteConsumerGroup = createAsyncThunk<
  ConsumerGroupID,
  { clusterName: ClusterName; consumerGroupID: ConsumerGroupID }
>(
  'consumerGroups/deleteConsumerGroup',
  async ({ clusterName, consumerGroupID }, { rejectWithValue }) => {
    try {
      await api.deleteConsumerGroup({
        clusterName,
        id: consumerGroupID,
      });

      return consumerGroupID;
    } catch (error) {
      return rejectWithValue(await getResponse(error as Response));
    }
  }
);

export const resetConsumerGroupOffsets = createAsyncThunk<
  ConsumerGroupID,
  ConsumerGroupResetOffsetRequestParams
>(
  'consumerGroups/resetConsumerGroupOffsets',
  async (
    { clusterName, consumerGroupID, requestBody },
    { rejectWithValue }
  ) => {
    try {
      await api.resetConsumerGroupOffsets({
        clusterName,
        id: consumerGroupID,
        consumerGroupOffsetsReset: {
          topic: requestBody.topic,
          resetType: requestBody.resetType,
          partitions: requestBody.partitions,
          partitionsOffsets: requestBody.partitionsOffsets?.map((offset) => ({
            ...offset,
            offset: +offset.offset,
          })),
          resetToTimestamp: requestBody.resetToTimestamp?.getTime(),
        },
      });
      return consumerGroupID;
    } catch (error) {
      return rejectWithValue(await getResponse(error as Response));
    }
  }
);
const SCHEMAS_PAGE_COUNT = 1;

const consumerGroupsAdapter = createEntityAdapter<ConsumerGroupDetails>({
  selectId: (consumerGroup) => consumerGroup.groupId,
});

interface ConsumerGroupState extends EntityState<ConsumerGroupDetails> {
  orderBy: ConsumerGroupOrdering | null;
  sortOrder: SortOrder;
  totalPages: number;
}

const initialState: ConsumerGroupState = {
  orderBy: null,
  sortOrder: SortOrder.ASC,
  totalPages: SCHEMAS_PAGE_COUNT,
  ...consumerGroupsAdapter.getInitialState(),
};

const consumerGroupsSlice = createSlice({
  name: 'consumerGroups',
  initialState,
  reducers: {
    orderBy: (state, action: PayloadAction<ConsumerGroupOrdering | null>) => {
      state.orderBy = action.payload;
    },
    sortBy: (
      state,
      action: PayloadAction<{
        orderBy: ConsumerGroupOrdering;
        sortOrder: SortOrder;
      }>
    ) => {
      state.orderBy = action.payload.orderBy;
      state.sortOrder =
        state.orderBy === action.payload.orderBy &&
        state.sortOrder === SortOrder.ASC
          ? SortOrder.DESC
          : SortOrder.ASC;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(
      fetchConsumerGroupsPaged.fulfilled,
      (state, { payload }) => {
        state.totalPages = payload.pageCount || SCHEMAS_PAGE_COUNT;
        consumerGroupsAdapter.setAll(state, payload.consumerGroups || []);
      }
    );
    builder.addCase(fetchConsumerGroups.fulfilled, (state, { payload }) => {
      consumerGroupsAdapter.setAll(state, payload);
    });
    builder.addCase(fetchConsumerGroupDetails.fulfilled, (state, { payload }) =>
      consumerGroupsAdapter.upsertOne(state, payload)
    );
    builder.addCase(deleteConsumerGroup.fulfilled, (state, { payload }) =>
      consumerGroupsAdapter.removeOne(state, payload)
    );
  },
});

export const consumerGroupsActions = consumerGroupsSlice.actions;

const consumerGroupsState = ({
  consumerGroups,
}: RootState): ConsumerGroupState => consumerGroups;

export const { selectAll, selectById } =
  consumerGroupsAdapter.getSelectors<RootState>(consumerGroupsState);

export const getAreConsumerGroupsPagedFulfilled = createSelector(
  createFetchingSelector('consumerGroups/fetchConsumerGroupsPaged'),
  (status) => status === 'fulfilled'
);

export const getAreConsumerGroupsFulfilled = createSelector(
  createFetchingSelector('consumerGroups/fetchConsumerGroups'),
  (status) => status === 'fulfilled'
);

export const getIsConsumerGroupDeleted = createSelector(
  createFetchingSelector('consumerGroups/deleteConsumerGroup'),
  (status) => status === 'fulfilled'
);

export const getAreConsumerGroupDetailsFulfilled = createSelector(
  createFetchingSelector('consumerGroups/fetchConsumerGroupDetails'),
  (status) => status === 'fulfilled'
);

export const getIsOffsetReseted = createSelector(
  createFetchingSelector('consumerGroups/resetConsumerGroupOffsets'),
  (status) => status === 'fulfilled'
);

export const getConsumerGroupsOrderBy = createSelector(
  consumerGroupsState,
  (state) => state.orderBy
);

export const getConsumerGroupsSortOrder = createSelector(
  consumerGroupsState,
  (state) => state.sortOrder
);

export default consumerGroupsSlice.reducer;
