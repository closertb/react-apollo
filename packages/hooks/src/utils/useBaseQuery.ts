import { useContext, useEffect, useReducer, useRef } from 'react';
import {
  getApolloContext,
  OperationVariables,
  QueryResult
} from '@apollo/react-common';
import { DocumentNode } from 'graphql';

import { QueryHookOptions, QueryOptions, QueryTuple } from '../types';
import { QueryData } from '../data/QueryData';
import { useDeepMemo } from './useDeepMemo';

export function useBaseQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode,
  options?: QueryHookOptions<TData, TVariables>,
  lazy = false
) {
  // 获取全局数据；
  const context = useContext(getApolloContext());
  // 创建一个reducer，来触发更新；
  const [tick, forceUpdate] = useReducer(x => x + 1, 0);

  // const BOOKS_QUERY = gql`
  //   query($top: Int){
  //     collections(top: $top) {
  //       total
  //       collections {
  //         book_id
  //         title
  //         image
  //       }
  //     }
  //   }
  // `;
  //   const { top } = props;
  //   const { loading, error, data = {} } = useQuery(BOOKS_QUERY, {
  //     variables: {
  //       top: +top
  //     }
  //   });
  // 请求体融合；
  const updatedOptions = options ? { ...options, query } : { query };

  const queryDataRef = useRef<QueryData<TData, TVariables>>();

  // 首次渲染，创建一个Ref
  if (!queryDataRef.current) {
    // 新建查询对象；
    queryDataRef.current = new QueryData<TData, TVariables>({
      options: updatedOptions as QueryOptions<TData, TVariables>,
      context,
      forceUpdate
    });
  }

  const queryData = queryDataRef.current;
  queryData.setOptions(updatedOptions);
  queryData.context = context;

  // `onError` and `onCompleted` callback functions will not always have a
  // stable identity, so we'll exclude them from the memoization key to
  // prevent `afterExecute` from being triggered un-necessarily.
  const memo = {
    options: { ...updatedOptions, onError: undefined, onCompleted: undefined },
    context,
    tick
  };

  // NOTE: options， context， tick任意一个属性变化；
  // 都会触发execute执行
  // 牵连到的方法：execute -> getExecuteResult -> getQueryResult(-> )
  // 伴随执行到的方法：removeQuerySubscription -> updateObservableQuery -> startQuerySubscription
  // 通常来说，execute会执行三次
  // 第一次是options变化，触发请求；
  // 第二步：请求开始变化，触发tick变化；
  // 第三步：请求完成；
  const result = useDeepMemo(
    () => (lazy ? queryData.executeLazy() : queryData.execute()),
    memo
  );

  const queryResult = lazy
    ? (result as QueryTuple<TData, TVariables>)[1]
    : (result as QueryResult<TData, TVariables>);

  // queryResult 结果改变，那就触发afterExecute方法
  useEffect(() => queryData.afterExecute({ lazy }), [
    queryResult.loading,
    queryResult.networkStatus,
    queryResult.error,
    queryResult.data
  ]);

  // 首次挂载时触发
  useEffect(() => {
    return () => queryData.cleanup();
  }, []);

  return result;
}
