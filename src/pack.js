import fs from 'fs';
import path from 'path';

import babel from '@babel/core';
import createHTML from './createHTML.js';

let ID = 0

const handelChunk = entry => {
  //找到当前文件
  const content = fs.readFileSync(entry, 'utf-8');
  //转换成 ast
  const ast = babel.parseSync(content, {
    sourceType: 'module',
  })

  const pathArr = []
  // 查找所有的import 路径
  babel.traverse(ast, {
    ImportDeclaration: ({node}) => {
      pathArr.push(node.source.value)
    }
  })

  // 代码转换
  const { code } = babel.transformFromAstSync(ast, null, {
    presets: ['@babel/preset-env'],
  });

  return {
    id: ID++,
    code,
    pathArr,
    fileName: entry
  }
}

const graph = entry => {
  const result = handelChunk(entry)
  const queue = [result]
  for(let result of queue) {
    result.mapping = {}
    const dirname = path.dirname(result.fileName);
    result.pathArr.forEach((relativePath)=>{
      const absolutePath = path.join(dirname, relativePath);
      const childResult = handelChunk(absolutePath)
      result.mapping[relativePath] = childResult.id
      queue.push(childResult)
    })
  }
  return queue;
}

const bundle = (graph) => {
  let modules = '';
  graph.forEach(asset => {
    modules += `${asset.id}: [
      function (require, module, exports) {
        ${asset.code}
      },
      ${JSON.stringify(asset.mapping)},
    ],`;
  });
  const result = `
    (function(modules) {
      function require(id) {
        const [fn, mapping] = modules[id];

        function localRequire(name) {
          return require(mapping[name]);
        }

        const module = { exports : {} };

        fn(localRequire, module, module.exports);

        return module.exports;
      }

      require(0);
    })({${modules}})
  `;

  return result;
}

// 生成图谱
const result = bundle(graph('./example/a.js'));

createHTML('aa.html', result)