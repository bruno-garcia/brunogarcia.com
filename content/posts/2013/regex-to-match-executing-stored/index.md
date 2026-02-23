---
title: "Regex to match executing a stored procedure within a stored procedure"
date: 2013-02-16T17:55:00.000+01:00
tags: ["Regex", "SQL"]
author: "Bruno Garcia"
showToc: false
draft: false
aliases:
  - /blogger/2013/regex-to-match-executing-stored/
description: "Using regex to find and match stored procedure calls nested inside other stored procedures in SQL Server."
---

Unless you're working with a custom string format, which requires you writing a regular expression, I suppose (suggest?) you'll look it up online, right?

If you need a Regex to match an [IP](https://web.archive.org/web/20250722150414/http://answers.oreilly.com/topic/318-how-to-match-ipv4-addresses-with-regular-expressions/), [MAC](http://stackoverflow.com/questions/4260467/what-is-a-regular-expression-for-a-mac-address) or an [E-mail](http://www.regular-expressions.info/email.html), would you spend time writing it? Chances are that you might leave room for false positives and/or false negatives, unless you **really** test it. That's why it's common to look it up online.

I needed to take a list of proc names and parse thousands of *create procedure* scripts, looking up if anything from the input list was used (executed) from those procs. **A procedure executing another procedure.**

This kind of call can be made in several different ways. It might have or not the database name (cross db call), server name (linked server), it might have or not the `EXEC`/`EXECUTE` keyword. It might have or not brackets or set the result to a variable.

Since I looked it up and couldn't find it, I wrote it.
In case you need it, here you go:

```regex
^\s*((exec(ute)?)\s+)?(@\w+\s+=\s+)?((\[?\w+\]?\[.]{1,2}){1,3})?\[?p_storedProcedure\]?\s.*$
```

Note that if you use SQL Server with default collation, [proc names are case insensitive](http://stackoverflow.com/questions/508739/are-sql-stored-procedures-case-sensitive). So make sure you let your Regex engine know it should **ignore cases**! Otherwise you'll have to mind the case of the `EXEC`/`EXECUTE` keywords anyway.

Also note that cross database and [linked server](http://msdn.microsoft.com/en-us/library/ms188279.aspx) calls will also match. Some examples of valid proc calls (that will match against the Regex) are:

```sql
p_storedProcedure -- comments
p_storedProcedure @id, @anotherParam
[p_storedProcedure] @id, @anotherParam
EXEC p_storedProcedure @id, @anotherParam
EXECUTE p_storedProcedure @id, @anotherParam
EXEC p_storedProcedure
EXEC p_storedProcedure -- comments
EXEC [p_storedProcedure] @id, @anotherParam
EXEC dbo.p_storedProcedure @id, @anotherParam
EXEC dbo.[p_storedProcedure] @id, @anotherParam
EXEC anySchema.[p_storedProcedure] @id, @anotherParam
EXECUTE dbo.[p_storedProcedure] @id, @anotherParam
EXEC [dbo].[p_storedProcedure] @id, @anotherParam
EXEC [dbo].p_storedProcedure @id, @anotherParam
EXEC DBTEST..p_storedProcedure @id, @anotherParam
EXEC DBTEST..[p_storedProcedure]
EXEC DBTEST.dbo.p_storedProcedure @id, @anotherParam
EXEC [DBTEST]..[p_storedProcedure] @id, @anotherParam
EXEC [DBTEST]..p_storedProcedure @id, @anotherParam
EXEC [DBTEST].[dbo].[p_storedProcedure] @id, @anotherParam
EXEC [LINKEDDATABASE].[DBTEST].[dbo].[p_storedProcedure] @id, @anotherParam
EXEC LINKEDDATABASE.DBTEST.dbo.p_storedProcedure @id, @anotherParam
EXEC LINKEDDATABASE.DBTEST..p_storedProcedure @id, @anotherParam
EXEC @paramName = [dbo].[p_storedProcedure] @id, @anotherParam
EXEC @paramName = dbo.p_storedProcedure
EXEC @paramName = p_storedProcedure @id, @anotherParam
EXECUTE @paramName = p_storedProcedure @id, @anotherParam
EXECUTE    @paramName     =     p_storedProcedure     @id, @anotherParam
```
