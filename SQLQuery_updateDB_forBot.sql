
alter table r_Emps add TChatID varchar(200)
go
/*
select * from r_Emps

select *
	from r_Emps
	where ShiftPostID=1 and LTRIM(ISNULL(Mobile,''))<>'' and LTRIM(ISNULL(TChatID,''))<>''
*/

CREATE TABLE it_SEstTBotMsgSends(
	ChID int NOT NULL,
	MsgSendsDate datetime NOT NULL
)
go
/*
--alter table t_SEst add msgCount int
alter table t_SEst drop column msgCount 
go
*/
/*
select * from t_SEst order by DocDate desc
*/
