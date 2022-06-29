# In-memory Implementation of GraphDB


# Overview
GraphDB consists of two main parts: graphs storage service and efficient query mechanism over the graph.

### Construction
- A graph contains vertices and edges, and provides access to query initializers like g.v()

### Query
- A query contains pipes, which make up a pipeline, and a virtual machine for processing pipelines. Each step in our pipeline has a state and a list of per step states that index correlates with the list of steps in query.program
- to find a node's second cousin , we could express it as `node.parents.parents.parents.children.children.children` where parent and children are instances of a step in our query. Each step is a reference to its pipeType (function which actually performs that step's operation)
- In the system, the query will look like , `g.v(node).out().out().out().in().in().in()` . Each step can take in args which are passd to that pipeType
- Each step is a composite entity combining pipeType function with arguments to apply to that function
- `g.v()` acts as a query initializer that allows us to chain steps. Query initializer uses vertex pipetype  

    ### Summary of Query Execution Model
    -  Each pipe returns one result at a time, not a set of results. Each pipe may be activated many times while evaluating a query.
    - A read/write head controls which pipe is activated next. The head starts at the end of the pipeline, and its movement is directed by the result of the currently active pipe.
    - That result might be one of the aforementioned gremlins. Each gremlin represents a potential query result, and they carry state with them through the pipes. 
    - Gremlins cause the head to move to the right.
    - A pipe can return a result of 'pull', which signals the head that it needs input and moves it to the right.
    - A result of 'done' tells the head that nothing prior needs to be activated again, and moves the head left.


### PipeTypes
- Form the core of the system. Each pipeType has a corresponding query method
- when we evalutate `g.v(node).out('parent').in('parent')` the query initializer returns a query object , the out call adds a new step and returns a query object and so on.
- PipeType take in a gremlin and produce more gremlins.

    ### Vertex PipeType
     - Given an vertex ID it returns a single new gremlin. Given a query it will find all matching vertices, and yield one new gremlin at a time until it has worked through them
     
    ### In/Out PipeType
     -  Powered by a simple Graph Traversal which returns a pipeType handler that accepts a gremlin as its input, and spawns a new gremlin each time it's queried. Once those gremlins are gone, it sends back a 'pull' request to get a new gremlin from its predecessor.

    ### Run PipeType
     -  Allows us to run a custom function to only return the required fields needed from the nodes of the returned result

    ### Unique PipeType
     - if duplication, rejects the repeats by sending back a 'pull' request to get a new gremlin

    ### Filter PipeType
     - allows us to have eloborate filters over the entire execution uptil now.

### Gremlins
- Gremlin travels through the graph and remember where it has been and allows us to find answers to the query in a lazy fashion.
- They have the current vertex and some local state

### Query Transformers
-  Query transformer is a function that accepts a program and returns a program, plus a priority level. Higher priority transformers are placed closer to the front of the list.

### Aliases
- TBA

### Performance
- TBA

----
## Usage

```javascript

    V = [ {name: 'alice'}                                         // alice gets auto-_id (prolly 1)
        , {_id: 10, name: 'bob', hobbies: ['asdf', {x:3}]}] 
    E = [ {_out: 1, _in: 10, _label: 'knows'} ]
    g = graphDB.graph(V, E)
    
    g.addVertex({name: 'charlie', _id: 'charlie'})                // string ids are fine
    g.addVertex({name: 'delta', _id: '30'})                       // in fact they're all strings
    g.addEdge({_out: 10, _in: 30, _label: 'parent'})
    g.addEdge({_out: 10, _in: 'charlie', _label: 'knows'})
    g.v(1).out('knows').out().run()                               // returns [charlie, delta]
    
    q = g.v(1).out('knows').out().take(1)
    q.run()                                                       // returns [charlie]
    q.run()                                                       // returns [delta]  
    q.run()                                                       // returns []
```
